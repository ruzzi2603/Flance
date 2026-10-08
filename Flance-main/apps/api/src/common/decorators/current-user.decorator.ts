import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Role } from "@prisma/client";

export interface JwtUserPayload {
  sub: string;
  email: string;
  role: Role;
  name?: string;
  avatarUrl?: string;
  id?: string;
  userId?: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUserPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtUserPayload;
  },
);
