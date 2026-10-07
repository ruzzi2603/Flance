import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { buildSubscriptionContract, SUBSCRIPTION_CONTRACT_KEY, type SubscriptionContract } from "./subscription-contract";

export interface ContractAcceptanceInput {
  userId: string;
  contractVersion: string;
  contractHash: string;
  plan: string;
  planPrice: number;
  billingAnchorDay: number;
  initialAmount: number;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  getSubscriptionContract(): SubscriptionContract {
    return buildSubscriptionContract();
  }

  /**
   * Garante que o usuário aceitou EXATAMENTE a versão atual exibida a ele.
   * Se o texto mudou entre a leitura e o aceite, obriga a reler.
   */
  assertCurrent(version: string | undefined, hash: string | undefined): SubscriptionContract {
    const current = this.getSubscriptionContract();
    if (!version || !hash || version !== current.version || hash !== current.hash) {
      throw new ConflictException("O contrato foi atualizado. Leia a nova versão e aceite novamente.");
    }
    return current;
  }

  /** Grava a prova do aceite, com o texto exato (snapshot). Idempotente por pagamento. */
  async recordAcceptance(input: ContractAcceptanceInput & { paymentId: string }) {
    const existing = await this.prisma.contractAcceptance.findUnique({ where: { paymentId: input.paymentId } });
    if (existing) return existing;

    const contract = this.getSubscriptionContract();
    return this.prisma.contractAcceptance.create({
      data: {
        userId: input.userId,
        contractKey: SUBSCRIPTION_CONTRACT_KEY,
        contractVersion: input.contractVersion,
        contractHash: input.contractHash,
        contractSnapshot: contract as unknown as object,
        plan: input.plan as any,
        planPrice: input.planPrice,
        billingAnchorDay: input.billingAnchorDay,
        initialAmount: input.initialAmount,
        paymentId: input.paymentId,
        ipAddress: input.ipAddress?.slice(0, 64) ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  }

  /** Último aceite do usuário (com o texto que ele aceitou) */
  async getLatestAcceptance(userId: string) {
    const acceptance = await this.prisma.contractAcceptance.findFirst({
      where: { userId },
      orderBy: { acceptedAt: "desc" },
    });
    if (!acceptance) throw new NotFoundException("Nenhum contrato aceito.");
    return {
      id: acceptance.id,
      version: acceptance.contractVersion,
      hash: acceptance.contractHash,
      acceptedAt: acceptance.acceptedAt.toISOString(),
      plan: acceptance.plan,
      contract: acceptance.contractSnapshot,
    };
  }
}
