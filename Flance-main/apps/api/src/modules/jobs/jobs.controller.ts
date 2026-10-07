import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { createJobSchema, type CreateJobInput } from "./schemas/jobs.schema";
import { JobsService } from "./jobs.service";

@Controller("jobs")
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get("health")
  health() {
    return this.jobsService.health();
  }

  @Get()
  async list(
    @Query("q") query?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    const take = Math.min(Math.max(Number(limit) || 40, 1), 100);
    const skip = Math.max(Number(offset) || 0, 0);
    return {
      success: true,
      data: await this.jobsService.findAll(query, take, skip),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(":id")
  async detail(@Param("id") id: string) {
    const job = await this.jobsService.findById(id);
    if (!job) {
      throw new NotFoundException("Job not found");
    }
    return {
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body(new ZodValidationPipe(createJobSchema)) body: CreateJobInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    if (user.role !== "CLIENT" && user.role !== "FREELANCER") {
      throw new ForbiddenException("Only authenticated users can create jobs");
    }

    return {
      success: true,
      data: await this.jobsService.create(body, user.sub),
      timestamp: new Date().toISOString(),
    };
  }
}

