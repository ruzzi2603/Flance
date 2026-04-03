import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { createHash, randomBytes, randomInt, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { UsersService } from "../users/users.service";
import type { LoginInput, RegisterInput } from "./schemas/auth.schema";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.usersService.findByEmail(input.email);
    if (existing) {
      throw new ConflictException("Email already in use");
    }

    const user = await this.usersService.createUser({
      ...input,
      role: "CLIENT",
    });
    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user };
  }

  async login(input: LoginInput) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPublicUser(user),
    };
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: this.usersService.toPublicUser(user),
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { sent: true };
    }

    const token = randomBytes(32).toString("hex");
    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + this.getResetExpiresInSeconds() * 1000);
    const tokenHash = this.hashToken(token);

    await this.prisma.passwordReset.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    await this.prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash,
        code,
        expiresAt,
      },
    });

    const baseUrl = process.env.WEB_BASE_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset/verify?token=${encodeURIComponent(token)}`;

    await this.sendResetEmail(user.email, code, resetUrl);

    return { sent: true, resetUrl };
  }

  async getResetOptions(token: string) {
    const reset = await this.getValidResetToken(token);
    const correct = reset.code;
    const options = new Set<string>([correct]);
    while (options.size < 3) {
      options.add(String(randomInt(100000, 1000000)));
    }
    return Array.from(options).sort(() => Math.random() - 0.5);
  }

  async verifyResetCode(token: string, code: string) {
    const reset = await this.getValidResetToken(token);
    if (reset.attempts >= 5) {
      throw new UnauthorizedException("Too many attempts");
    }
    if (reset.code !== code) {
      await this.prisma.passwordReset.update({
        where: { id: reset.id },
        data: { attempts: reset.attempts + 1 },
      });
      throw new UnauthorizedException("Invalid code");
    }

    await this.prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });

    const resetToken = await this.signResetToken({
      sub: reset.userId,
      email: reset.user.email,
    });

    return resetToken;
  }

  async resetPassword(token: string, password: string) {
    const payload = await this.verifyResetToken(token);
    await this.usersService.updatePassword(payload.sub, password);
    await this.prisma.refreshToken.updateMany({
      where: { userId: payload.sub, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueTokens(payload: {
    id: string;
    email: string;
    role: "CLIENT" | "FREELANCER";
    name?: string;
    avatarUrl?: string;
  }) {
    const accessToken = await this.signAccessToken({
      sub: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
      avatarUrl: this.normalizeAvatarForToken(payload.avatarUrl),
    });
    const refreshToken = await this.signRefreshToken({
      sub: payload.id,
      email: payload.email,
      role: payload.role,
    });

    await this.rotateRefreshToken(payload.id, refreshToken);

    return { accessToken, refreshToken };
  }

  private signAccessToken(payload: {
    sub: string;
    email: string;
    role: "CLIENT" | "FREELANCER";
    name?: string;
    avatarUrl?: string;
  }) {
    return this.jwtService.signAsync(payload, {
      expiresIn: this.getAccessExpiresInSeconds(),
    });
  }

  private signResetToken(payload: { sub: string; email: string }) {
    return this.jwtService.signAsync(
      { ...payload, type: "reset", jti: randomUUID() },
      { expiresIn: this.getResetExpiresInSeconds() },
    );
  }

  private normalizeAvatarForToken(avatarUrl?: string) {
    if (!avatarUrl) return undefined;
    if (avatarUrl.startsWith("data:")) return undefined;
    if (avatarUrl.length > 320) return undefined;
    return avatarUrl;
  }

  private signRefreshToken(payload: { sub: string; email: string; role: "CLIENT" | "FREELANCER" }) {
    return this.jwtService.signAsync(
      { ...payload, type: "refresh", jti: randomUUID() },
      { expiresIn: this.getRefreshExpiresInSeconds() },
    );
  }

  private async verifyResetToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<
        { sub: string; email: string; type?: string }
      >(token);
      if (payload.type !== "reset") {
        throw new UnauthorizedException("Invalid reset token");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid reset token");
    }
  }

  private async verifyRefreshToken(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync<
        { sub: string; email: string; role: "CLIENT" | "FREELANCER"; type?: string }
      >(token);
      if (payload.type !== "refresh") {
        throw new UnauthorizedException("Invalid refresh token");
      }
      return payload;
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  private async getValidResetToken(token: string) {
    const tokenHash = this.hashToken(token);
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new UnauthorizedException("Invalid reset token");
    }

    return reset;
  }

  private async rotateRefreshToken(userId: string, refreshToken: string) {
    const now = new Date();
    const expiresAt = new Date(Date.now() + this.getRefreshExpiresInSeconds() * 1000);
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private getAccessExpiresInSeconds() {
    return Number(process.env.JWT_EXPIRES_IN_SECONDS || 3600);
  }

  private getRefreshExpiresInSeconds() {
    return Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || 604800);
  }

  private getResetExpiresInSeconds() {
    return Number(process.env.JWT_RESET_EXPIRES_IN_SECONDS || 900);
  }

  private async sendResetEmail(email: string, code: string, resetUrl: string) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 465);
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass || !from) {
      throw new UnauthorizedException("SMTP not configured");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    const subject = "Recuperacao de senha - Flance";
    const text = `Recebemos seu pedido de recuperacao de senha.\n\nCodigo: ${code}\n\nAbra o link: ${resetUrl}\n\nSe voce nao solicitou, ignore.`;
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2>Recuperacao de senha</h2>
        <p>Recebemos seu pedido de recuperacao de senha.</p>
        <p><strong>Codigo:</strong> ${code}</p>
        <p>Abra o link para validar: <a href="${resetUrl}">${resetUrl}</a></p>
        <p>Se voce nao solicitou, ignore esta mensagem.</p>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: email,
      subject,
      text,
      html,
    });
  }
}
