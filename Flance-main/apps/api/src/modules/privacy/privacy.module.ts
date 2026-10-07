import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { RetentionService } from "./retention.service";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, RetentionService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
