import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";

@Injectable()
export class PaymentEmailService {
  private readonly logger = new Logger(PaymentEmailService.name);

  private getTransporter() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 465);

    if (!host || !user || !pass) {
      this.logger.warn("SMTP não configurado. E-mails de pagamento não serão enviados.");
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  private getFromAddress(): string {
    return process.env.SMTP_FROM || process.env.SMTP_USER || "contato@flance.com.br";
  }

  /**
   * Envia o código de ativação de 6 dígitos após confirmação de pagamento (Regra 20)
   */
  async sendActivationCodeEmail(params: {
    to: string;
    userName: string;
    planName: string;
    code: string;
    expiresInMinutes?: number;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn(`Não foi possível enviar e-mail com código para ${params.to} (SMTP desabilitado)`);
      return false;
    }

    const { to, userName, planName, code, expiresInMinutes = 30 } = params;
    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:3000";

    const subject = `Pagamento confirmado! Ative seu plano ${planName} na Flance`;
    const text = `Olá, ${userName}!\n\nSeu pagamento do plano ${planName} foi confirmado com sucesso!\n\nCódigo de ativação: ${code}\n\nDigite esse código no Flance para ativar seu plano:\n${webBaseUrl}/checkout?step=code\n\nEste código expira em ${expiresInMinutes} minutos.\n\nEquipe Flance`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #38bdf8; font-size: 26px; margin: 0 0 8px;">Pagamento confirmado! 🎉</h1>
          <p style="color: #94a3b8; font-size: 15px; margin: 0;">Seu pagamento do plano <strong>${planName}</strong> foi aprovado.</p>
        </div>

        <div style="background: #1e293b; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px; border: 1px solid #334155;">
          <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Seu código de ativação</p>
          <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #38bdf8; font-family: monospace; padding: 12px; background: #0f172a; border-radius: 8px; display: inline-block;">
            ${code}
          </div>
          <p style="color: #f59e0b; font-size: 13px; margin: 16px 0 0;">⏱️ Esse código expira em <strong>${expiresInMinutes} minutos</strong>.</p>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${webBaseUrl}/checkout?step=code" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 15px;">
            Ativar meu plano agora
          </a>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0 0 4px;">Se você não solicitou este plano, ignore este e-mail.</p>
          <p style="margin: 0;">Flance &copy; ${new Date().getFullYear()} - Todos os direitos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`E-mail com código de ativação enviado com sucesso para ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar e-mail para ${to}: ${err?.message || err}`);
      return false;
    }
  }

  /**
   * Envia aviso de 3 dias para expiração do plano (Regra 25)
   */
  async sendRenewalReminderEmail(params: {
    to: string;
    userName: string;
    planName: string;
    daysRemaining: number;
    expiresAtDateString: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const { to, userName, planName, daysRemaining, expiresAtDateString } = params;
    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:3000";

    const subject = `⚠️ Sua assinatura Flance vence em ${daysRemaining} dias`;
    const text = `Olá, ${userName}!\n\nSua assinatura do plano ${planName} vence em ${daysRemaining} dias (${expiresAtDateString}).\n\nRenove agora para continuar aproveitando todos os recursos profissionais da sua empresa no Flance:\n${webBaseUrl}/planos\n\nEquipe Flance`;

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 8px;">Aviso de Renovação ⚠️</h1>
          <p style="color: #94a3b8; font-size: 15px; margin: 0;">Sua assinatura do plano <strong>${planName}</strong> vence em breve.</p>
        </div>

        <div style="background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #334155;">
          <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px;">Data de vencimento: <strong>${expiresAtDateString}</strong></p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">Renove com antecedência para não perder o destaque dos seus anúncios e recursos profissionais. Dias restantes serão mantidos e somados ao novo período!</p>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${webBaseUrl}/planos" style="display: inline-block; background: #f59e0b; color: #0f172a; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">
            Renovar agora
          </a>
        </div>

        <div style="border-top: 1px solid #1e293b; padding-top: 20px; text-align: center; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Flance &copy; ${new Date().getFullYear()} - Todos os direitos reservados.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: this.getFromAddress(),
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`E-mail de aviso de renovação enviado para ${to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar e-mail de renovação para ${to}: ${err?.message || err}`);
      return false;
    }
  }

  private async sendLayoutEmail(params: {
    to: string;
    subject: string;
    heading: string;
    color: string;
    intro: string;
    rows: Array<[string, string]>;
    ctaLabel: string;
    ctaPath: string;
    footnote?: string;
    logLabel: string;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (!transporter) return false;

    const webBaseUrl = process.env.WEB_BASE_URL || "http://localhost:3000";
    const url = `${webBaseUrl}${params.ctaPath}`;
    const rowsText = params.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
    const text = `${params.intro}\n\n${rowsText}\n\n${params.ctaLabel}: ${url}${params.footnote ? `\n\n${params.footnote}` : ""}\n\nEquipe Flance`;
    const rowsHtml = params.rows
      .map(([k, v]) => `<p style="color: #cbd5e1; font-size: 14px; margin: 0 0 8px;">${k}: <strong>${v}</strong></p>`)
      .join("");

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; background: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
        <h1 style="color: ${params.color}; font-size: 24px; margin: 0 0 12px; text-align: center;">${params.heading}</h1>
        <p style="color: #94a3b8; font-size: 15px; text-align: center; margin: 0 0 24px;">${params.intro}</p>
        <div style="background: #1e293b; padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid #334155;">${rowsHtml}</div>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${url}" style="display: inline-block; background: ${params.color}; color: #0f172a; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">${params.ctaLabel}</a>
        </div>
        ${params.footnote ? `<p style="color: #64748b; font-size: 12px; text-align: center;">${params.footnote}</p>` : ""}
        <div style="border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px;">Flance &copy; ${new Date().getFullYear()}</div>
      </div>`;

    try {
      await transporter.sendMail({ from: this.getFromAddress(), to: params.to, subject: params.subject, text, html });
      this.logger.log(`E-mail (${params.logLabel}) enviado para ${params.to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Falha ao enviar e-mail (${params.logLabel}) para ${params.to}: ${err?.message || err}`);
      return false;
    }
  }

  private brl(value: number) {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }

  private dateBr(date: Date) {
    return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  }

  /** Mensalidade disponível / perto de vencer / em atraso (Pix) */
  async sendInvoiceEmail(params: {
    to: string;
    userName: string;
    planName: string;
    amount: number;
    dueDate: Date;
    paymentId: string;
    variant: "reminder" | "overdue";
  }): Promise<boolean> {
    const overdue = params.variant === "overdue";
    return this.sendLayoutEmail({
      to: params.to,
      subject: overdue
        ? `Sua mensalidade Flance está em atraso (venceu em ${this.dateBr(params.dueDate)})`
        : `Sua mensalidade Flance vence em ${this.dateBr(params.dueDate)}`,
      heading: overdue ? "Mensalidade em atraso ⚠️" : "Sua mensalidade vence em breve",
      color: overdue ? "#f59e0b" : "#38bdf8",
      intro: `Olá, ${params.userName}! ${overdue ? "Não identificamos o pagamento" : "Já está disponível o Pix"} do plano ${params.planName}.`,
      rows: [
        ["Valor", this.brl(params.amount)],
        ["Vencimento", this.dateBr(params.dueDate)],
      ],
      ctaLabel: "Pagar com Pix",
      ctaPath: `/checkout?paymentId=${params.paymentId}`,
      footnote: overdue
        ? "Pague o quanto antes para manter seu plano. Após alguns dias de tolerância, a conta volta ao plano gratuito."
        : "O Pix não é débito automático: é preciso pagar a cada mês. Para cancelar a renovação, acesse Minha assinatura.",
      logLabel: overdue ? "mensalidade em atraso" : "lembrete de mensalidade",
    });
  }

  /** Recibo da mensalidade paga */
  async sendRenewalConfirmedEmail(params: {
    to: string;
    userName: string;
    planName: string;
    amount: number;
    validUntil: Date;
  }): Promise<boolean> {
    return this.sendLayoutEmail({
      to: params.to,
      subject: `Pagamento recebido: plano ${params.planName} renovado`,
      heading: "Pagamento recebido ✅",
      color: "#22c55e",
      intro: `Olá, ${params.userName}! Recebemos o pagamento e seu plano ${params.planName} foi renovado.`,
      rows: [
        ["Valor", this.brl(params.amount)],
        ["Plano ativo até", this.dateBr(params.validUntil)],
      ],
      ctaLabel: "Ver minha assinatura",
      ctaPath: "/assinatura",
      logLabel: "mensalidade paga",
    });
  }

  /** Aviso de fim de plano quando a renovação foi cancelada, ou plano encerrado por falta de pagamento */
  async sendSubscriptionEndEmail(params: {
    to: string;
    userName: string;
    planName: string;
    endsAt: Date;
    ended: boolean;
  }): Promise<boolean> {
    return this.sendLayoutEmail({
      to: params.to,
      subject: params.ended ? `Seu plano ${params.planName} foi encerrado` : `Seu plano ${params.planName} termina em ${this.dateBr(params.endsAt)}`,
      heading: params.ended ? "Plano encerrado" : "Seu plano está terminando",
      color: "#f59e0b",
      intro: params.ended
        ? `Olá, ${params.userName}! Sem o pagamento da mensalidade, sua conta voltou ao plano gratuito. Seus dados foram mantidos.`
        : `Olá, ${params.userName}! A renovação do plano ${params.planName} está cancelada e ele termina em ${this.dateBr(params.endsAt)}.`,
      rows: [["Plano", params.planName], [params.ended ? "Encerrado em" : "Termina em", this.dateBr(params.endsAt)]],
      ctaLabel: params.ended ? "Assinar novamente" : "Reativar renovação",
      ctaPath: params.ended ? "/planos" : "/assinatura",
      logLabel: params.ended ? "plano encerrado" : "fim de plano",
    });
  }
}
