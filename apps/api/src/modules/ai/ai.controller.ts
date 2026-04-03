import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MatchingService } from "./matching.service";
import { aiMatchSchema, type AiMatchInput } from "./schemas/ai.schema";

@Controller("ai")
export class AiController {
  constructor(private readonly matchingService: MatchingService) {}

  @Post("match")
  @UsePipes(new ZodValidationPipe(aiMatchSchema))
  match(@Body() body: AiMatchInput) {
    return this.matchingService.rankFreelancers(body.description, body.freelancers);
  }
}

