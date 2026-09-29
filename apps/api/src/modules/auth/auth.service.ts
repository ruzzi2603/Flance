import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { Role } from "@prisma/client";
import { createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { UsersService } from "../users/users.service";
import type { LoginInput, RegisterInput, VerifyRegistrationEmailInput } from "./schemas/auth.schema";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    const existing = await this.usersService.findByEmail(email);
    if (existing?.emailVerifiedAt) {
      throw new ConflictException("Email already in use");
    }

    const passwordHash = existing?.passwordHash ?? await bcrypt.hash(input.password, 12);
    const resendAfterSeconds = await this.issueRegistrationCode({
      email,
      name: existing?.name ?? input.name,
      passwordHash,
      avatarUrl: existing?.avatarUrl ?? input.avatarUrl,
    });
    return { verificationRequired: true, email, resendAfterSeconds };
  }

  async resendRegistrationCode(emailInput: string) {
    const email = emailInput.toLowerCase();
    const user = await this.usersService.findByEmail(email);
    const pending = await this.prisma.emailVerificationCode.findUnique({ where: { email } });
    if (user?.emailVerifiedAt || (!user && !pending)) {
      return { sent: true, resendAfterSeconds: 60 };
    }

    const resendAfterSeconds = await this.issueRegistrationCode({
      email,
      name: user?.name ?? pending!.name,
      passwordHash: user?.passwordHash ?? pending!.passwordHash,
      avatarUrl: user?.avatarUrl ?? pending?.avatarUrl ?? undefined,
    });
    return { sent: true, resendAfterSeconds };
  }

  async verifyRegistrationCode(input: VerifyRegistrationEmailInput) {
    const email = input.email.toLowerCase();
    const verification = await this.prisma.emailVerificationCode.findUnique({ where: { email } });
    if (!verification) throw new UnauthorizedException("Verification code is invalid or expired");
    if (verification.expiresAt <= new Date()) {
      await this.prisma.emailVerificationCode.delete({ where: { id: verification.id } });
      throw new UnauthorizedException("Verification code expired. Request a new one.");
    }
    if (verification.attempts >= 5) {
      throw new HttpException("Too many verification attempts. Request a new code.", HttpStatus.TOO_MANY_REQUESTS);
    }

    const submittedHash = Buffer.from(this.hashRegistrationCode(email, input.code), "hex");
    const storedHash = Buffer.from(verification.codeHash, "hex");
    if (!timingSafeEqual(submittedHash, storedHash)) {
      await this.prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Verification code is invalid");
    }

    const userId = await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({ where: { email }, select: { id: true, emailVerifiedAt: true } });
      let id: string;
      if (existing) {
        if (existing.emailVerifiedAt) throw new ConflictException("Email is already verified");
        const verified = await transaction.user.update({
          where: { id: existing.id },
          data: { emailVerifiedAt: new Date() },
          select: { id: true },
        });
        id = verified.id;
      } else {
        const created = await transaction.user.create({
          data: {
            email,
            password: verification.passwordHash,
            name: verification.name,
            role: "CLIENT",
            avatarUrl: verification.avatarUrl,
            emailVerifiedAt: new Date(),
          },
          select: { id: true },
        });
        id = created.id;
      }
      await transaction.emailVerificationCode.delete({ where: { id: verification.id } });
      return id;
    });

    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("User could not be loaded");
    const tokens = await this.issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      avatarUrl: user.avatarUrl,
    });
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: this.usersService.toPublicUser(user) };
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
    if (!user.emailVerifiedAt) {
      const resendAfterSeconds = await this.issueRegistrationCode({
        email: user.email,
        name: user.name,
        passwordHash: user.passwordHash,
        avatarUrl: user.avatarUrl,
      });
      throw new ForbiddenException({
        message: "Email verification required",
        resendAfterSeconds,
      });
    }
    if (user.bannedAt) {
      throw new ForbiddenException(user.banReason || "This account has been suspended");
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
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException("Email verification required");
    }
    if (user.bannedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException("Account is unavailable");
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
    role: Role;
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
    role: Role;
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

  private signRefreshToken(payload: { sub: string; email: string; role: Role }) {
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
        { sub: string; email: string; role: Role; type?: string }
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

  private async issueRegistrationCode(input: {
    email: string;
    name: string;
    passwordHash: string;
    avatarUrl?: string | null;
  }) {
    const now = new Date();
    const pending = await this.prisma.emailVerificationCode.findUnique({ where: { email: input.email } });
    const waitMilliseconds = pending ? 60_000 - (now.getTime() - pending.lastSentAt.getTime()) : 0;
    if (waitMilliseconds > 0) return Math.ceil(waitMilliseconds / 1000);

    const code = String(randomInt(100_000, 1_000_000));
    const verification = await this.prisma.emailVerificationCode.upsert({
      where: { email: input.email },
      create: {
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        avatarUrl: input.avatarUrl ?? null,
        codeHash: this.hashRegistrationCode(input.email, code),
        expiresAt: new Date(now.getTime() + 60_000),
        lastSentAt: now,
        attempts: 0,
      },
      update: {
        name: input.name,
        passwordHash: input.passwordHash,
        avatarUrl: input.avatarUrl ?? null,
        codeHash: this.hashRegistrationCode(input.email, code),
        expiresAt: new Date(now.getTime() + 60_000),
        lastSentAt: now,
        attempts: 0,
      },
      select: { id: true },
    });

    try {
      await this.sendRegistrationEmail(input.email, input.name, code);
    } catch {
      await this.prisma.emailVerificationCode.update({
        where: { id: verification.id },
        data: { lastSentAt: new Date(now.getTime() - 60_000) },
      });
      throw new ServiceUnavailableException("Could not send the verification email. Try again shortly.");
    }
    return 60;
  }

  private hashRegistrationCode(email: string, code: string) {
    const secret = process.env.EMAIL_VERIFICATION_SECRET || process.env.JWT_SECRET;
    if (!secret) throw new Error("EMAIL_VERIFICATION_SECRET or JWT_SECRET is required");
    return createHmac("sha256", secret).update(`${email}:${code}`).digest("hex");
  }

  private async sendRegistrationEmail(email: string, name: string, code: string) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 465);
    const from = process.env.SMTP_FROM || user;
    if (!host || !user || !pass || !from) {
      throw new ServiceUnavailableException("Email delivery is not configured");
    }
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    await transporter.sendMail({
      from,
      to: email,
      subject: "Codigo de verificacao da Flance",
      text: `Ola, ${name}. Seu codigo de verificacao e ${code}. Ele expira em 1 minuto. Se voce nao criou uma conta, ignore este email.`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Confirme seu email</h2><p>Ola, ${this.escapeEmailHtml(name)}.</p><p>Digite este codigo no site da Flance:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>O codigo expira em 1 minuto. Se voce nao criou uma conta, ignore este email.</p></div>`,
    });
  }

  private escapeEmailHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
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
