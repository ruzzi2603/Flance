import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

interface JwtPayload {
  sub?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: Role;
  name?: string;
  avatarUrl?: string;
}

function extractJwtFromCookie(request: { cookies?: Record<string, string> }) {
  return request?.cookies?.flance_access_token ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is required");
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractJwtFromCookie,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    // Normalize claims from current and legacy access tokens to one trusted user ID.
    const userId = payload.sub || payload.id || payload.userId;
    const select = { id: true, email: true, role: true, bannedAt: true, emailVerifiedAt: true } as const;
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select })
      : payload.email
        ? await this.prisma.user.findUnique({ where: { email: payload.email }, select })
        : null;
    if (!user || user.bannedAt || !user.emailVerifiedAt) {
      throw new UnauthorizedException("Account is unavailable");
    }
    return { ...payload, sub: user.id, id: user.id, email: user.email, role: user.role };
  }
}
