import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Module({
  imports: [PassportModule.register({ defaultStrategy: "jwt" })],
  controllers: [AdminController],
  providers: [AdminGuard, AdminService],
})
export class AdminModule {}