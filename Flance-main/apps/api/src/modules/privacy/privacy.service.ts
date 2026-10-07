import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { PrismaService } from "../../common/prisma/prisma.service";
import { SubscriptionsService } from "../payments/subscriptions.service";
import { decryptCpf } from "../payments/utils/cpf-crypto";
import { buildAnonymizedUserData } from "./user-anonymization";

/**
 * Direitos do titular (LGPD art. 18) em autoatendimento: exportar os próprios dados e excluir a conta.
 * Ações sensíveis exigem a senha de novo (reautenticação), mesmo com sessão ativa.
 */
@Injectable()
export class PrivacyService {
  private readonly logger = new Logger(PrivacyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  /** Reautenticação. Usa 403 (e não 401) para o front não interpretar como sessão expirada. */
  private async assertPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, password: true } });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new ForbiddenException("Senha incorreta.");
    return user;
  }

  private maskCpf(cpfEncrypted: string | null): string | null {
    if (!cpfEncrypted) return null;
    try {
      const digits = decryptCpf(cpfEncrypted).replace(/\D/g, "");
      return `***.***.***-${digits.slice(-2)}`;
    } catch {
      return null;
    }
  }

  /** Cópia dos dados do titular em JSON (acesso e portabilidade). Nunca inclui hashes, tokens ou CPF completo. */
  async exportData(userId: string, password: string) {
    await this.assertPassword(userId, password);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, name: true, role: true, emailVerifiedAt: true, createdAt: true, updatedAt: true,
        bio: true, avatarUrl: true, headline: true, services: true, servicesTags: true, needs: true,
        companyEnabled: true, companyName: true, companyCnpj: true, companyDescription: true, companyLocation: true,
        companyCity: true, companyState: true, companyAddress: true, companyWebsite: true, companyInstagram: true,
        companyWhatsapp: true, companyEmail: true, companyHours: true, companyPhotos: true,
        companyIsOnline: true, companyIsPhysical: true, companyViews: true,
        planTier: true, planStartedAt: true, planRenewsAt: true, xp: true, level: true, cpfEncrypted: true,
      },
    });
    if (!user) throw new NotFoundException("Usuário não encontrado.");
    const { cpfEncrypted, ...account } = user;

    const [payments, subscriptions, contractAcceptances, reviewsAuthored, reviewsReceived, jobs, proposals, badges, messagesSent, conversations] =
      await Promise.all([
        this.prisma.payment.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: { id: true, kind: true, plan: true, amount: true, status: true, dueDate: true, paidAt: true, coversUntil: true, createdAt: true },
        }),
        this.prisma.subscription.findMany({
          where: { userId },
          orderBy: { createdAt: "asc" },
          select: { id: true, plan: true, status: true, startedAt: true, expiresAt: true, billingAnchorDay: true, nextDueDate: true, recurringAmount: true, cancelAtPeriodEnd: true, canceledAt: true, createdAt: true },
        }),
        this.prisma.contractAcceptance.findMany({
          where: { userId },
          orderBy: { acceptedAt: "asc" },
          select: { id: true, contractVersion: true, contractHash: true, plan: true, planPrice: true, billingAnchorDay: true, initialAmount: true, ipAddress: true, userAgent: true, acceptedAt: true },
        }),
        this.prisma.companyReview.findMany({ where: { authorId: userId } }),
        this.prisma.companyReview.findMany({ where: { companyId: userId } }),
        this.prisma.job.findMany({ where: { clientId: userId } }),
        this.prisma.proposal.findMany({ where: { freelancerId: userId } }),
        this.prisma.badge.findMany({ where: { userId } }),
        this.prisma.message.findMany({
          where: { senderId: userId },
          orderBy: { createdAt: "asc" },
          select: { id: true, conversationId: true, body: true, createdAt: true },
        }),
        this.prisma.conversation.count({ where: { OR: [{ clientId: userId }, { freelancerId: userId }] } }),
      ]);

    return {
      format: "flance-data-export/1",
      generatedAt: new Date().toISOString(),
      notes: [
        "Cópia dos seus dados pessoais tratados pela Flance (LGPD, art. 18).",
        "O CPF aparece mascarado por segurança. Hashes de senha e tokens de sessão não são exportados.",
        "Mensagens recebidas de outras pessoas não estão incluídas, pois contêm dados de terceiros.",
      ],
      account: { ...account, cpf: this.maskCpf(cpfEncrypted) },
      billing: { payments, subscriptions, contractAcceptances },
      activity: { badges, reviewsAuthored, reviewsReceived, jobs, proposals, conversationsCount: conversations, messagesSent },
    };
  }

  /**
   * Exclui (ou anonimiza) a conta dentro da transação recebida. Reutilizado pelo admin.
   *  - Sem histórico financeiro: exclusão total.
   *  - Com histórico (pagamento, assinatura ou aceite de contrato): ANONIMIZA e mantém só as provas
   *    que a lei exige guardar (5 anos). Apaga todo o conteúdo e as credenciais.
   * @returns true se anonimizou; false se excluiu por completo.
   */
  async eraseUserInTransaction(tx: any, userId: string): Promise<boolean> {
    const retained =
      (await tx.payment.count({ where: { userId } })) +
        (await tx.subscription.count({ where: { userId } })) +
        (await tx.contractAcceptance.count({ where: { userId } })) >
      0;

    if (!retained) {
      await tx.user.delete({ where: { id: userId } });
      return false;
    }

    const now = new Date();
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.passwordReset.deleteMany({ where: { userId } });
    // Pix pendente não pode mais ser processado para uma conta excluída
    await tx.payment.updateMany({ where: { userId, status: "PENDING" }, data: { status: "CANCELED" } });
    // Encerra o plano; o Pix de renovação pendente é cancelado no Asaas por cancelRecurringBilling / rotina diária
    await tx.subscription.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { cancelAtPeriodEnd: true, canceledAt: now, expiresAt: now },
    });

    // Conteúdo pessoal
    const conversations = await tx.conversation.findMany({
      where: { OR: [{ clientId: userId }, { freelancerId: userId }] },
      select: { id: true },
    });
    const conversationIds = conversations.map((c: { id: string }) => c.id);
    if (conversationIds.length) {
      await tx.message.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await tx.conversation.deleteMany({ where: { id: { in: conversationIds } } });
    }
    await tx.message.deleteMany({ where: { senderId: userId } });
    await tx.companyReview.deleteMany({ where: { OR: [{ authorId: userId }, { companyId: userId }] } });
    await tx.companyAnalyticsEvent.deleteMany({ where: { companyId: userId } });
    await tx.badge.deleteMany({ where: { userId } });
    await tx.proposal.deleteMany({ where: { freelancerId: userId } });
    await tx.job.deleteMany({ where: { clientId: userId } });

    await tx.user.update({ where: { id: userId }, data: buildAnonymizedUserData(userId, now) });
    return true;
  }

  /** Encerra o plano e cancela já o Pix de renovação pendente no Asaas (a rotina diária repete se falhar). */
  async cancelRecurringBilling(userId: string) {
    const subscriptions = await this.prisma.subscription.findMany({ where: { userId, status: "ACTIVE" } });
    for (const subscription of subscriptions) {
      try {
        await this.subscriptionsService.expireSubscription(subscription);
      } catch (error: any) {
        this.logger.error(`Não foi possível cancelar a cobrança da assinatura ${subscription.id}: ${error?.message}`);
      }
    }
  }

  /** Exclusão pelo próprio titular. */
  async deleteAccount(userId: string, password: string) {
    const user = await this.assertPassword(userId, password);
    if (user.role === "ADMIN") {
      throw new ForbiddenException("Contas de administrador não podem ser excluídas por aqui.");
    }

    const anonymized = await this.prisma.$transaction((tx: any) => this.eraseUserInTransaction(tx, userId));
    if (anonymized) await this.cancelRecurringBilling(userId);

    this.logger.log(`Conta ${userId} ${anonymized ? "anonimizada (histórico financeiro retido)" : "excluída por completo"}.`);
    return { deleted: true, anonymized };
  }
}
