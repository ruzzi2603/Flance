import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { LoggerModule } from "../../common/logger/logger.module";
import { ChatModule } from "../chat/chat.module";
import { UsersModule } from "../users/users.module";
import { ProposalsController } from "./proposals.controller";
import { ProposalsService } from "./proposals.service";

@Module({
  imports: [PrismaModule, LoggerModule, ChatModule, UsersModule],
  controllers: [ProposalsController],
  providers: [ProposalsService],
})
export class ProposalsModule {}
