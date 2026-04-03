import { Module } from "@nestjs/common";
import { AiController } from "./ai.controller";
import { AiService } from "./ai.service";
import { MatchingService } from "./matching.service";

@Module({
  controllers: [AiController],
  providers: [AiService, MatchingService],
  exports: [AiService, MatchingService],
})
export class AiModule {}

