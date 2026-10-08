import { Body, Controller, Get, Patch, Post, UseGuards, Query, Param, NotFoundException } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { updateProfileSchema, type UpdateProfileInput } from "./schemas/update-profile.schema";
import { UsersService } from "./users.service";
import { companyReviewSchema, type CompanyReviewInput } from "./schemas/company-review.schema";
import {
  companyShareSchema,
  companyVisitDurationSchema,
  companyVisitSchema,
} from "./schemas/company-analytics.schema";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @Get("health")
  health() {
    return this.usersService.health();
  }

  @Get("freelancers")
  async listFreelancers(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);
    const data = await this.usersService.listFreelancers(query, take, skip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("freelancers/:id")
  async getFreelancer(@Param("id") id: string) {
    const data = await this.usersService.getFreelancerById(id);
    if (!data) {
      throw new NotFoundException("Freelancer not found");
    }
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("companies")
  async listCompanies(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);
    const data = await this.usersService.listCompanies(query, take, skip);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("companies/:id")
  async getCompany(@Param("id") id: string) {
    const data = await this.usersService.getCompanyById(id);
    if (!data) {
      throw new NotFoundException("Company not found");
    }
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("companies/:id/analytics/views")
  async recordCompanyView(
    @Param("id") companyId: string,
    @Body(new ZodValidationPipe(companyVisitSchema)) body: { sessionId: string },
  ) {
    const data = await this.usersService.recordCompanyView(companyId, body.sessionId);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("companies/:id/analytics/views/:visitId/duration")
  async updateCompanyViewDuration(
    @Param("id") companyId: string,
    @Param("visitId") visitId: string,
    @Body(new ZodValidationPipe(companyVisitDurationSchema)) body: { durationSeconds: number },
  ) {
    await this.usersService.updateCompanyViewDuration(companyId, visitId, body.durationSeconds);
    return { success: true, data: { updated: true }, timestamp: new Date().toISOString() };
  }

  @Post("companies/:id/analytics/shares")
  async recordCompanyShare(
    @Param("id") companyId: string,
    @Body(new ZodValidationPipe(companyShareSchema)) body: { sessionId: string; source: string },
  ) {
    const data = await this.usersService.recordCompanyShare(companyId, body.sessionId, body.source);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("companies/:id/analytics")
  @UseGuards(JwtAuthGuard)
  async getCompanyAnalytics(@Param("id") companyId: string, @CurrentUser() user: JwtUserPayload) {
    const data = await this.usersService.getCompanyAnalytics(companyId, user.sub);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("companies/:id/reviews")
  async listCompanyReviews(@Param("id") id: string) {
    const data = await this.usersService.listCompanyReviews(id);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Post("companies/:id/reviews")
  @UseGuards(JwtAuthGuard)
  async reviewCompany(
    @Param("id") companyId: string,
    @Body(new ZodValidationPipe(companyReviewSchema)) body: CompanyReviewInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const data = await this.usersService.upsertCompanyReview(companyId, user.sub, body);
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Get("public/:id")
  async getPublicProfile(@Param("id") id: string) {
    const data = await this.usersService.getPublicProfileById(id);
    if (!data) {
      throw new NotFoundException("User not found");
    }
    return { success: true, data, timestamp: new Date().toISOString() };
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @CurrentUser() user: JwtUserPayload,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    const updated = await this.usersService.updateProfile(user.sub, body);
    return { success: true, data: updated, timestamp: new Date().toISOString() };
  }
}
