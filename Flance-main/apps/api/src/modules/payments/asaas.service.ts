import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { maskCpf } from "./utils/cpf-validator";

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  email: string;
  cpfCnpj?: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  externalReference?: string;
  /** ID da assinatura do Asaas que gerou esta cobrança (quando recorrente) */
  subscription?: string;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  value: number;
  nextDueDate: string;
  cycle: string;
  billingType: string;
  status: string;
  externalReference?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string; // Base64 PNG do QR code
  payload: string; // Pix copia e cola
  expirationDate: string;
}

@Injectable()
export class AsaasService {
  private readonly logger = new Logger(AsaasService.name);

  private get apiKey(): string {
    const key = process.env.ASAAS_API_KEY;
    if (!key) {
      this.logger.error("ASAAS_API_KEY não configurada no ambiente.");
      throw new InternalServerErrorException("Integração de pagamentos não configurada.");
    }
    return key.trim();
  }

  private get baseUrl(): string {
    const raw = (process.env.ASAAS_BASE_URL || "https://api-sandbox.asaas.com/v3").trim();
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new InternalServerErrorException("ASAAS_BASE_URL inválida.");
    }
    if (
      url.protocol !== "https:" ||
      !["api-sandbox.asaas.com", "api.asaas.com"].includes(url.hostname) ||
      url.pathname.replace(/\/+$/, "") !== "/v3"
    ) {
      throw new InternalServerErrorException("ASAAS_BASE_URL deve usar a API oficial v3 do Asaas.");
    }
    return raw.replace(/\/+$/, "");
  }

  private assertApiKeyEnvironment() {
    const key = this.apiKey;
    const isSandbox = new URL(this.baseUrl).hostname === "api-sandbox.asaas.com";
    const isSandboxKey = key.startsWith("$aact_hmlg_");
    const isProductionKey = key.startsWith("$aact_prod_");
    if ((isSandbox && isProductionKey) || (!isSandbox && isSandboxKey)) {
      this.logger.error("A chave Asaas não corresponde ao ambiente configurado.");
      throw new InternalServerErrorException("A chave do Asaas não corresponde ao ambiente Sandbox/Produção configurado.");
    }
  }

  private getHeaders(): Record<string, string> {
    this.assertApiKeyEnvironment();
    return {
      "Content-Type": "application/json",
      access_token: this.apiKey,
      "User-Agent": "Flance-App/1.0",
    };
  }

  /**
   * Executa requisição HTTP segura para a API do Asaas
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(15_000),
        headers: {
          ...this.getHeaders(),
          ...(options.headers as Record<string, string> | undefined),
        },
      });
    } catch (err: any) {
      this.logger.error(`Erro de conexão com Asaas (${err?.code || err?.name || "network"}).`);
      throw new BadGatewayException("Não foi possível conectar ao serviço de pagamentos. Tente novamente em instantes.");
    }

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { rawText: text };
    }

    if (!response.ok) {
      const providerCodes = Array.isArray(data?.errors)
        ? data.errors.map((item: any) => item.code).filter(Boolean).join(",")
        : "";
      this.logger.warn(`Asaas API respondeu HTTP ${response.status}${providerCodes ? ` (${providerCodes})` : ""}.`);
      if (response.status === 404) throw new NotFoundException("Registro não encontrado no Asaas.");
      if (response.status === 401) throw new InternalServerErrorException("Credencial Asaas inválida para o ambiente configurado.");
      if (response.status >= 500) {
        throw new BadGatewayException("O serviço de pagamentos está temporariamente indisponível.");
      }
      throw new BadRequestException("O Asaas não aceitou os dados da cobrança. Confira os dados e tente novamente.");
    }

    return data as T;
  }

  /**
   * Busca ou cria cliente no Asaas (Regra 10)
   * Evita duplicação desnecessária de clientes.
   */
  async findOrCreateCustomer(params: {
    name: string;
    email: string;
    cpf: string;
    userId: string;
    existingCustomerId?: string | null;
  }): Promise<string> {
    const { name, email, cpf, userId, existingCustomerId } = params;

    // 1. Se já tem ID no banco, verifica se ainda existe no Asaas
    if (existingCustomerId) {
      try {
        const existing = await this.request<AsaasCustomerResponse>(`/customers/${existingCustomerId}`, {
          method: "GET",
        });
        if (existing?.id) {
          this.logger.log(`Cliente Asaas existente reutilizado: ${existing.id}`);
          return existing.id;
        }
      } catch (err) {
        if (!(err instanceof NotFoundException)) throw err;
        this.logger.warn("Cliente vinculado não existe no Asaas; buscando cadastro correspondente.");
      }
    }

    // 2. Busca por CPF no Asaas
    try {
      const search = await this.request<{ data: AsaasCustomerResponse[] }>(
        `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
        { method: "GET" },
      );
      if (search?.data && search.data.length > 0) {
        const found = search.data[0];
        this.logger.log(`Cliente Asaas localizado por CPF: ${found.id} (CPF: ${maskCpf(cpf)})`);
        return found.id;
      }
    } catch (err) {
      if (!(err instanceof NotFoundException)) throw err;
      this.logger.warn(`Cliente não encontrado no Asaas para CPF ${maskCpf(cpf)}.`);
    }

    // 3. Cria novo cliente no Asaas
    this.logger.log(`Criando novo cliente Asaas para usuário: ${userId} (CPF: ${maskCpf(cpf)})`);
    const created = await this.request<AsaasCustomerResponse>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name,
        email,
        cpfCnpj: cpf,
        externalReference: userId,
        notificationDisabled: true, // Notificações gerenciadas pelo Flance
      }),
    });

    return created.id;
  }

  /**
   * Cria cobrança Pix no Asaas (Regra 9, 13)
   */
  async createPixPayment(params: {
    customerId: string;
    amount: number;
    description: string;
    externalReference: string;
    dueDate?: string;
  }): Promise<AsaasPaymentResponse> {
    const { customerId, amount, description, externalReference } = params;

    // Data de vencimento: amanhã ou data fornecida (formato YYYY-MM-DD)
    const dueDate =
      params.dueDate ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const body = {
      customer: customerId,
      billingType: "PIX",
      value: amount,
      dueDate,
      description,
      externalReference,
    };

    this.logger.log(`Criando cobrança Pix Asaas para cliente ${customerId} no valor de R$ ${amount}`);
    return this.request<AsaasPaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Obtém QR Code Pix e Copia e Cola da cobrança (Regra 14)
   */
  async getPixQrCode(providerPaymentId: string): Promise<AsaasPixQrCodeResponse> {
    return this.request<AsaasPixQrCodeResponse>(`/payments/${providerPaymentId}/pixQrCode`, {
      method: "GET",
    });
  }

  /**
   * Consulta dados de um pagamento no Asaas
   */
  async getPayment(providerPaymentId: string): Promise<AsaasPaymentResponse> {
    return this.request<AsaasPaymentResponse>(`/payments/${providerPaymentId}`, {
      method: "GET",
    });
  }

  async findPaymentsByExternalReference(externalReference: string): Promise<AsaasPaymentResponse[]> {
    const result = await this.request<{ data?: AsaasPaymentResponse[] }>(
      `/payments?externalReference=${encodeURIComponent(externalReference)}`,
      { method: "GET" },
    );
    return result.data ?? [];
  }

  /**
   * Cria a assinatura mensal no Asaas (Pix, vencimento em nextDueDate e no mesmo dia nos meses seguintes).
   * O Asaas gera uma cobrança Pix por mês e dispara o webhook PAYMENT_CREATED.
   */
  async createSubscription(params: {
    customerId: string;
    value: number;
    nextDueDate: string; // YYYY-MM-DD
    description: string;
    externalReference: string;
  }): Promise<AsaasSubscriptionResponse> {
    this.logger.log(`Criando assinatura Asaas (${params.nextDueDate}) para cliente ${params.customerId}`);
    return this.request<AsaasSubscriptionResponse>("/subscriptions", {
      method: "POST",
      body: JSON.stringify({
        customer: params.customerId,
        billingType: "PIX",
        value: params.value,
        nextDueDate: params.nextDueDate,
        cycle: "MONTHLY",
        description: params.description,
        externalReference: params.externalReference,
      }),
    });
  }

  /** Cancela a assinatura no Asaas. Se já não existe lá, considera cancelada. */
  async deleteSubscription(providerSubscriptionId: string): Promise<void> {
    try {
      await this.request(`/subscriptions/${providerSubscriptionId}`, { method: "DELETE" });
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
  }

  /** Cobranças geradas por uma assinatura (reconcilia quando um webhook se perde) */
  async listSubscriptionPayments(providerSubscriptionId: string, status = "PENDING"): Promise<AsaasPaymentResponse[]> {
    const result = await this.request<{ data?: AsaasPaymentResponse[] }>(
      `/subscriptions/${providerSubscriptionId}/payments?status=${encodeURIComponent(status)}`,
      { method: "GET" },
    );
    return result.data ?? [];
  }

  /** Cancela uma cobrança ainda não paga no Asaas. Se já não existe lá, considera cancelada. */
  async deletePayment(providerPaymentId: string): Promise<void> {
    try {
      await this.request(`/payments/${providerPaymentId}`, { method: "DELETE" });
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
  }
}
