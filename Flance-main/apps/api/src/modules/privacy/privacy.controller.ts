import { Body, Controller, Post, Res, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { deleteAccountSchema, exportDataSchema, type DeleteAccountInput, type ExportDataInput } from "./privacy.schemas";
import { PrivacyService } from "./privacy.service";

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

@Controller("privacy")
@UseGuards(JwtAuthGuard)
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  /** Baixar uma cópia dos meus dados. POST /v1/privacy/export  { password } */
  @Post("export")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async exportData(
    @CurrentUser() user: JwtUserPayload,
    @Body(new ZodValidationPipe(exportDataSchema)) body: ExportDataInput,
  ) {
    const data = await this.privacyService.exportData(user.sub, body.password);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  /** Excluir minha conta. POST /v1/privacy/delete-account  { password, confirmation: "EXCLUIR" } */
  @Post("delete-account")
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async deleteAccount(
    @CurrentUser() user: JwtUserPayload,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: DeleteAccountInput,
    @Res({ passthrough: true }) response: Response,
  ) {
    const data = await this.privacyService.deleteAccount(user.sub, body.password);
    response.clearCookie("flance_access_token", cookieOptions());
    response.clearCookie("flance_refresh_token", cookieOptions());
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}
