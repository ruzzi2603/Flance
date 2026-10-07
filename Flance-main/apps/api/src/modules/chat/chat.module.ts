import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { LoggerModule } from "../../common/logger/logger.module";
import { ChatController } from "./chat.controller";
import { ChatGateway } from "./chat.gateway";
import { ChatService } from "./chat.service";
import { RealtimeService } from "./realtime.service";

@Module({
  imports: [
    PrismaModule,
    LoggerModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-secret",
    }),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, RealtimeService],
  exports: [RealtimeService],
})
export class ChatModule {}

