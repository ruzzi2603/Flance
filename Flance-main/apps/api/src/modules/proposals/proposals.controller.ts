import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser, type JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  createProposalSchema,
  cancelProposalSchema,
  updateProposalSchema,
  updateProposalBidSchema,
  type CreateProposalInput,
  type CancelProposalInput,
  type UpdateProposalInput,
  type UpdateProposalBidInput,
} from "./schemas/proposals.schema";
import { ProposalsService } from "./proposals.service";
import { UsersService } from "../users/users.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ProposalsController {
  constructor(
    private readonly proposalsService: ProposalsService,
    private readonly usersService: UsersService,
  ) {}

  @Post("jobs/:id/proposals")
  async create(
    @Param("id") jobId: string,
    @Body(new ZodValidationPipe(createProposalSchema)) body: CreateProposalInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    const current = await this.usersService.findById(user.sub);
    if (current?.role !== "FREELANCER") {
      throw new ForbiddenException(
        "Para enviar proposta, voce precisa criar uma conta de prestador.",
      );
    }

    const proposal = await this.proposalsService.create(jobId, user.sub, body);
    return { success: true, data: proposal, timestamp: new Date().toISOString() };
  }

  @Get("proposals/received")
  async listForClient(@CurrentUser() user: JwtUserPayload) {
    if (user.role !== "CLIENT") {
      throw new ForbiddenException("Only clients can view received proposals");
    }

    const proposals = await this.proposalsService.listForClient(user.sub);
    return { success: true, data: proposals, timestamp: new Date().toISOString() };
  }

  @Get("proposals/sent")
  async listForFreelancer(@CurrentUser() user: JwtUserPayload) {
    if (user.role !== "FREELANCER") {
      throw new ForbiddenException("Only freelancers can view sent proposals");
    }

    const proposals = await this.proposalsService.listForFreelancer(user.sub);
    return { success: true, data: proposals, timestamp: new Date().toISOString() };
  }

  @Patch("proposals/:id")
  async updateStatus(
    @Param("id") proposalId: string,
    @Body(new ZodValidationPipe(updateProposalSchema)) body: UpdateProposalInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    if (user.role !== "CLIENT") {
      throw new ForbiddenException("Only clients can update proposals");
    }

    const updated = await this.proposalsService.updateStatus(proposalId, user.sub, body.status);
    return { success: true, data: updated, timestamp: new Date().toISOString() };
  }

  @Patch("proposals/:id/bid")
  async updateBid(
    @Param("id") proposalId: string,
    @Body(new ZodValidationPipe(updateProposalBidSchema)) body: UpdateProposalBidInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    if (user.role !== "FREELANCER") {
      throw new ForbiddenException("Only freelancers can update proposal bids");
    }

    const updated = await this.proposalsService.updateBid(proposalId, user.sub, body.bidAmount);
    return { success: true, data: updated, timestamp: new Date().toISOString() };
  }

  @Post("proposals/:id/cancel")
  async cancelAgreement(
    @Param("id") proposalId: string,
    @Body(new ZodValidationPipe(cancelProposalSchema)) body: CancelProposalInput,
    @CurrentUser() user: JwtUserPayload,
  ) {
    if (user.role !== "CLIENT") {
      throw new ForbiddenException("Only clients can cancel agreements");
    }

    const updated = await this.proposalsService.cancelAgreement(proposalId, user.sub, body.reason);
    return { success: true, data: updated, timestamp: new Date().toISOString() };
  }
}
