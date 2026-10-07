import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import {
  createPaymentSchema,
  type CreatePaymentInput,
} from "./schemas/payment.schema";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get("health")
  health() {
    return this.paymentsService.health();
  }

  /**
   * Lista os planos centralizados da aplicação
   * GET /v1/payments/plans
   */
  @Get("plans")
  getPlans() {
    const data = this.paymentsService.getAvailablePlans();
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Simulação do 1º pagamento (valor cheio, primeiro mês) antes do aceite
   * GET /v1/payments/quote?plan=PROFESSIONAL
   */
  @Get("quote")
  getQuote(@Query("plan") plan: string) {
    const data = this.paymentsService.getQuote(plan ?? "");
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Cria o 1º pagamento Pix (exige aceite do contrato)
   * POST /v1/payments/create
   */
  @Post("create")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(createPaymentSchema))
  async createPayment(
    @CurrentUser() user: JwtUserPayload,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() input: CreatePaymentInput,
    @Req() req: any,
  ) {
    // req.ip já considera o "trust proxy" configurado no main.ts. Ler X-Forwarded-For direto
    // permitiria ao cliente forjar o IP gravado como prova do aceite.
    const data = await this.paymentsService.createPayment(user.sub, input, idempotencyKey, {
      ipAddress: req?.ip || null,
      userAgent: req?.headers?.["user-agent"] ?? null,
    });
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Pagamento confirmado aguardando o código de ativação (declarada ANTES de :id)
   * GET /v1/payments/pending-activation
   */
  @Get("pending-activation")
  @UseGuards(JwtAuthGuard)
  async getPendingActivation(@CurrentUser() user: JwtUserPayload) {
    const data = await this.paymentsService.getPendingActivation(user.sub);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Consulta status de um pagamento
   * GET /v1/payments/:id
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async getPayment(
    @CurrentUser() user: JwtUserPayload,
    @Param("id") paymentId: string,
  ) {
    const data = await this.paymentsService.getPaymentById(user.sub, paymentId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post(":id/activation-code/resend")
  @UseGuards(JwtAuthGuard)
  async resendActivationCode(@CurrentUser() user: JwtUserPayload, @Param("id") paymentId: string) {
    const data = await this.paymentsService.resendActivationCode(user.sub, paymentId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Webhook do Asaas para confirmação e eventos de pagamento (Regra 15 e 16)
   * POST /v1/payments/webhook
   */
  @Post("webhook")
  async handleWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: any,
  ) {
    const result = await this.paymentsService.handleWebhook(headers, body);
    return { success: true, ...result, timestamp: new Date().toISOString() };
  }
}
