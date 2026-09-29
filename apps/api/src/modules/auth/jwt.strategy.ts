import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { Role } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, bannedAt: true, emailVerifiedAt: true },
    });
    if (!user || user.bannedAt || !user.emailVerifiedAt) {
      throw new UnauthorizedException("Account is unavailable");
    }
    return { ...payload, role: user.role };
  }
}
