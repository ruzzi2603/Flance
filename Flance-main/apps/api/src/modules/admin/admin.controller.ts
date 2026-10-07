import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { adModerationSchema, moderationReasonSchema, type AdModerationInput, type ModerationReasonInput } from "./admin.schemas";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  async listUsers(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);
    return { success: true, data: await this.adminService.listUsers(query, take, skip), timestamp: new Date().toISOString() };
  }

  @Get("ads")
  async listAds(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);
    return { success: true, data: await this.adminService.listAds(query, take, skip), timestamp: new Date().toISOString() };
  }

  @Get("audit")
  async listAuditLogs(@Query("limit") limit?: string) {
    const take = Math.min(Math.max(Number(limit) || 100, 1), 200);
    return { success: true, data: await this.adminService.listAuditLogs(take), timestamp: new Date().toISOString() };
  }

  @Patch("ads/:id")
  async moderateAd(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(adModerationSchema)) body: AdModerationInput,
    @CurrentUser() admin: JwtUserPayload,
  ) {
    const data = await this.adminService.moderateAd(admin.sub, id, body.active, body.reason);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("users/:id/ban")
  async banUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReasonInput,
    @CurrentUser() admin: JwtUserPayload,
  ) {
    const data = await this.adminService.banUser(admin.sub, id, body.reason);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("users/:id/alert")
  async alertUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReasonInput,
    @CurrentUser() admin: JwtUserPayload,
  ) {
    const data = await this.adminService.alertUser(admin.sub, id, body.reason);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("users/:id/unban")
  async unbanUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReasonInput,
    @CurrentUser() admin: JwtUserPayload,
  ) {
    const data = await this.adminService.unbanUser(admin.sub, id, body.reason);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Delete("users/:id")
  async deleteUser(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(moderationReasonSchema)) body: ModerationReasonInput,
    @CurrentUser() admin: JwtUserPayload,
  ) {
    const data = await this.adminService.deleteUser(admin.sub, id, body.reason);
    return { success: true, data, timestamp: new Date().toISOString() };
  }
}