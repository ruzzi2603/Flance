import { Body, Controller, Get, Patch, UseGuards, UsePipes, UnauthorizedException, Req, Query, Param, NotFoundException } from "@nestjs/common";
import type { Request } from "express";
import { JwtService } from "@nestjs/jwt";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { updateProfileSchema, type UpdateProfileInput } from "./schemas/update-profile.schema";
import { UsersService } from "./users.service";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
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
  @UsePipes(new ZodValidationPipe(updateProfileSchema))
  async updateProfile(
    @CurrentUser() user: JwtUserPayload,
    @Body() body: UpdateProfileInput,
    @Req() request: Request,
  ) {
    const userId = user.sub || user.id;
    if (userId) {
      const updated = await this.usersService.updateProfile(userId, body);
      return { success: true, data: updated, timestamp: new Date().toISOString() };
    }

    const token = request.cookies?.flance_access_token;
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<{ sub?: string; id?: string; email?: string }>(token);
        const fallbackId = payload.sub || payload.id;
        if (fallbackId) {
          const updated = await this.usersService.updateProfile(fallbackId, body);
          return { success: true, data: updated, timestamp: new Date().toISOString() };
        }
        if (payload.email) {
          const existing = await this.usersService.findByEmail(payload.email);
          if (existing) {
            const updated = await this.usersService.updateProfile(existing.id, body);
            return { success: true, data: updated, timestamp: new Date().toISOString() };
          }
        }
      } catch {
        // fall through
      }
    }

    if (user.email) {
      const existing = await this.usersService.findByEmail(user.email);
      if (existing) {
        const updated = await this.usersService.updateProfile(existing.id, body);
        return { success: true, data: updated, timestamp: new Date().toISOString() };
      }
    }

    throw new UnauthorizedException("Invalid session");
  }
}
