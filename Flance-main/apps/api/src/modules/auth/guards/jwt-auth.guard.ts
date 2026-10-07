import { ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext, status?: any): TUser {
    if (process.env.NODE_ENV !== "production" && (err || !user)) {
      const request = context.switchToHttp().getRequest();
      const authorization = request.headers?.authorization;
      this.logger.warn(
        `JWT rejected ${request.method} ${request.path}: ${info?.message || err?.message || "missing user"}; ` +
          `bearer=${typeof authorization === "string" && authorization.startsWith("Bearer ")}; ` +
          `accessCookie=${Boolean(request.cookies?.flance_access_token)}`,
      );
    }

    return super.handleRequest(err, user, info, context, status);
  }
}
