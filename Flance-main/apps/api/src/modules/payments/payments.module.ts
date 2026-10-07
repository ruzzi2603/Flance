import { Module } from "@nestjs/common";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { ContractsModule } from "../contracts/contracts.module";
import { AsaasService } from "./asaas.service";
import { PaymentEmailService } from "./payment-email.service";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SubscriptionsCheckService } from "./subscriptions-check.service";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  imports: [PrismaModule, ContractsModule],
  controllers: [PaymentsController, SubscriptionsController],
  providers: [
    PaymentsService,
    SubscriptionsService,
    AsaasService,
    PaymentEmailService,
    SubscriptionsCheckService,
  ],
  exports: [PaymentsService, SubscriptionsService, AsaasService],
})
export class PaymentsModule {}
