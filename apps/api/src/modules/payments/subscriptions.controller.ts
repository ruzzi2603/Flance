import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
} from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  activateSubscriptionSchema,
  renewSubscriptionSchema,
  type ActivateSubscriptionInput,
  type RenewSubscriptionInput,
} from "./schemas/payment.schema";
import { SubscriptionsService } from "./subscriptions.service";

@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Consulta a assinatura atual do usuário logado
   * GET /v1/subscriptions/me
   */
  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMySubscription(@CurrentUser() user: JwtUserPayload) {
    const data = await this.subscriptionsService.getMySubscription(user.sub);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Ativa assinatura com o código de 6 dígitos recebido por e-mail
   * POST /v1/subscriptions/activate
   */
  @Post("activate")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(activateSubscriptionSchema))
  async activateSubscription(
    @CurrentUser() user: JwtUserPayload,
    @Body() input: ActivateSubscriptionInput,
  ) {
    const data = await this.subscriptionsService.activateSubscription(user.sub, input);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /**
   * Inicia renovação manual de plano
   * POST /v1/subscriptions/renew
   */
  @Post("renew")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ZodValidationPipe(renewSubscriptionSchema))
  async renewSubscription(
    @CurrentUser() user: JwtUserPayload,
    @Body() input: RenewSubscriptionInput,
  ) {
    const data = await this.subscriptionsService.renewSubscription(user.sub, input);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
