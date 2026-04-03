import { Injectable } from "@nestjs/common";

@Injectable()
export class PaymentsService {
  health() {
    return { status: "ok" };
  }
}

