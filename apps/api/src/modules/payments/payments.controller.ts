import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
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
   * Cria uma cobrança Pix para plano pago
   * POST /v1/payments/create
   */
  @Post("create")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(createPaymentSchema))
  async createPayment(
    @CurrentUser() user: JwtUserPayload,
    @Body() input: CreatePaymentInput,
  ) {
    const data = await this.paymentsService.createPayment(user.sub, input);
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
