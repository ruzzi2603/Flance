import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { PrivacyModule } from "../privacy/privacy.module";
import { ChatModule } from "../chat/chat.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" }), PrivacyModule, ChatModule],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}
