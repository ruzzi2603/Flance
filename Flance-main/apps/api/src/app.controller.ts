import { Controller, Get } from "@nestjs/common";

interface HealthResponse {
  service: "flance-api";
  status: "ok";
  version: string;
}

interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Controller()
export class AppController {
  @Get("health")
  health(): ApiSuccess<HealthResponse> {
    return {
      success: true,
      data: {
        service: "flance-api",
        status: "ok",
        version: "v1",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
