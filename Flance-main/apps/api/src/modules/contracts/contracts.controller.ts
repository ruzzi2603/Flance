import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ContractsService } from "./contracts.service";

@Controller("contracts")
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /** Texto vigente (público: pode ser lido antes de criar conta) */
  @Get("subscription")
  getSubscriptionContract() {
    return { success: true, data: this.contractsService.getSubscriptionContract(), timestamp: new Date().toISOString() };
  }

  /** Último contrato aceito pelo usuário logado, com o texto exato que ele aceitou */
  @Get("subscription/accepted")
  @UseGuards(JwtAuthGuard)
  async getAccepted(@CurrentUser() user: JwtUserPayload) {
    const data = await this.contractsService.getLatestAcceptance(user.sub);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
