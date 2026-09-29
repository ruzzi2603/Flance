import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
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
    const raw = process.env.ASAAS_BASE_URL || "https://sandbox.asaas.com/api/v3";
    return raw.replace(/\/+$/, "");
  }

  private getHeaders(): Record<string, string> {
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
        headers: {
          ...this.getHeaders(),
          ...(options.headers as Record<string, string> | undefined),
        },
      });
    } catch (err: any) {
      this.logger.error(`Erro de conexão com Asaas: ${err?.message || err}`);
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
      const errorMessage =
        Array.isArray(data?.errors) && data.errors.length > 0
          ? data.errors.map((e: any) => e.description).join("; ")
          : data?.message || `Erro Asaas HTTP ${response.status}`;

      this.logger.warn(`Asaas API Error [${response.status}]: ${errorMessage}`);
      throw new BadRequestException(`Erro no provedor de pagamento: ${errorMessage}`);
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
        this.logger.warn(`Cliente Asaas ${existingCustomerId} não encontrado na API. Buscando por CPF.`);
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
      this.logger.warn(`Falha na busca de cliente por CPF: ${maskCpf(cpf)}`);
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
}
