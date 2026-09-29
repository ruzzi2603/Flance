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
}
