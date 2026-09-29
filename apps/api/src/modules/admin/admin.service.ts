import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { AdminActionType, Prisma, Role } from "@prisma/client";
import nodemailer from "nodemailer";
import { PrismaService } from "../../common/prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: string | undefined, limit: number, offset: number) {
    const search = query?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          companyEnabled: true,
          companyName: true,
          bannedAt: true,
          banReason: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async listAds(query: string | undefined, limit: number, offset: number) {
    const search = query?.trim();
    const where: Prisma.UserWhereInput = {
      OR: [{ companyEnabled: true }, { companyName: { not: null } }],
      ...(search
        ? {
            AND: [{
              OR: [
                { companyName: { contains: search, mode: "insensitive" as const } },
                { companyDescription: { contains: search, mode: "insensitive" as const } },
                { email: { contains: search, mode: "insensitive" as const } },
                { name: { contains: search, mode: "insensitive" as const } },
              ],
            }],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          companyName: true,
          companyDescription: true,
          companyLocation: true,
          companyEnabled: true,
          createdAt: true,
          bannedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  async listAuditLogs(limit: number) {
    return this.prisma.adminAuditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        adminId: true,
        targetUserId: true,
        targetEmail: true,
        targetName: true,
        action: true,
        reason: true,
        notificationStatus: true,
        createdAt: true,
      },
    });
  }

  async moderateAd(adminId: string, targetId: string, active: boolean, reason: string) {
    const target = await this.prisma.user.findFirst({
      where: { id: targetId, companyName: { not: null } },
      select: { id: true, email: true, name: true, companyName: true, role: true },
    });
    if (!target) throw new NotFoundException("Advertisement not found");
    if (target.role === "ADMIN") throw new ForbiddenException("Administrator listings cannot be moderated here");

    const action = active ? AdminActionType.AD_RESTORED : AdminActionType.AD_REMOVED;
    const audit = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({ where: { id: target.id }, data: { companyEnabled: active } });
      return transaction.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: target.id,
          targetEmail: target.email,
          targetName: target.companyName || target.name,
          action,
          reason,
        },
        select: { id: true },
      });
    });

    const notificationStatus = await this.sendNotice({
      email: target.email,
      name: target.name,
      subject: active ? "Seu anuncio foi reativado na Flance" : "Seu anuncio foi removido da Flance",
      action: active ? "reativado" : "removido",
      reason,
      itemLabel: `Anuncio: ${target.companyName}`,
    });
    await this.updateNotificationStatus(audit.id, notificationStatus);
    return { active, notificationStatus };
  }

  async alertUser(adminId: string, targetId: string, reason: string) {
    const target = await this.getModeratableUser(adminId, targetId);
    const audit = await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        targetUserId: target.id,
        targetEmail: target.email,
        targetName: target.name,
        action: AdminActionType.USER_ALERTED,
        reason,
      },
      select: { id: true },
    });
    const notificationStatus = await this.sendNotice({
      email: target.email,
      name: target.name,
      subject: "Aviso da equipe Flance",
      action: "recebeu um aviso da equipe de administracao",
      reason,
    });
    await this.updateNotificationStatus(audit.id, notificationStatus);
    return { notified: notificationStatus === "SENT", notificationStatus };
  }

  async banUser(adminId: string, targetId: string, reason: string) {
    const target = await this.getModeratableUser(adminId, targetId);
    if (target.bannedAt) throw new ConflictException("User is already banned");
    const audit = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: target.id },
        data: { bannedAt: new Date(), banReason: reason },
      });
      await transaction.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return transaction.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: target.id,
          targetEmail: target.email,
          targetName: target.name,
          action: AdminActionType.USER_BANNED,
          reason,
        },
        select: { id: true },
      });
    });
    const notificationStatus = await this.sendNotice({
      email: target.email,
      name: target.name,
      subject: "Sua conta Flance foi suspensa",
      action: "suspensa",
      reason,
    });
    await this.updateNotificationStatus(audit.id, notificationStatus);
    return { banned: true, notificationStatus };
  }

  async unbanUser(adminId: string, targetId: string, reason: string) {
    const target = await this.getModeratableUser(adminId, targetId);
    if (!target.bannedAt) throw new ConflictException("User is not banned");
    const audit = await this.prisma.$transaction(async (transaction) => {
      await transaction.user.update({
        where: { id: target.id },
        data: { bannedAt: null, banReason: null },
      });
      return transaction.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: target.id,
          targetEmail: target.email,
          targetName: target.name,
          action: AdminActionType.USER_UNBANNED,
          reason,
        },
        select: { id: true },
      });
    });
    const notificationStatus = await this.sendNotice({
      email: target.email,
      name: target.name,
      subject: "Sua conta Flance foi reativada",
      action: "reativada",
      reason,
    });
    await this.updateNotificationStatus(audit.id, notificationStatus);
    return { banned: false, notificationStatus };
  }

  async deleteUser(adminId: string, targetId: string, reason: string) {
    const target = await this.getModeratableUser(adminId, targetId);
    const audit = await this.prisma.$transaction(async (transaction) => {
      const log = await transaction.adminAuditLog.create({
        data: {
          adminId,
          targetUserId: target.id,
          targetEmail: target.email,
          targetName: target.name,
          action: AdminActionType.USER_DELETED,
          reason,
        },
        select: { id: true },
      });
      await transaction.user.delete({ where: { id: target.id } });
      return log;
    });
    const notificationStatus = await this.sendNotice({
      email: target.email,
      name: target.name,
      subject: "Sua conta Flance foi excluida",
      action: "excluida permanentemente",
      reason,
    });
    await this.updateNotificationStatus(audit.id, notificationStatus);
    return { deleted: true, notificationStatus };
  }

  private async getModeratableUser(adminId: string, targetId: string) {
    if (adminId === targetId) throw new ForbiddenException("You cannot moderate your own account");
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, name: true, role: true, bannedAt: true },
    });
    if (!target) throw new NotFoundException("User not found");
    if (target.role === Role.ADMIN) throw new ForbiddenException("Administrator accounts cannot be moderated here");
    return target;
  }

  private async updateNotificationStatus(logId: string, notificationStatus: "SENT" | "FAILED") {
    await this.prisma.adminAuditLog.update({ where: { id: logId }, data: { notificationStatus } });
  }

  private async sendNotice(input: {
    email: string;
    name: string;
    subject: string;
    action: string;
    reason: string;
    itemLabel?: string;
  }): Promise<"SENT" | "FAILED"> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 465);
    const from = process.env.SMTP_FROM || user;
    if (!host || !user || !pass || !from) return "FAILED";

    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] ?? character);
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
    const itemLabel = input.itemLabel ? `${input.itemLabel}\n` : "";
    try {
      await transporter.sendMail({
        from,
        to: input.email,
        subject: input.subject,
        text: `Ola, ${input.name}.\n\nSua conta/anuncio foi ${input.action}.\n${itemLabel}\nMotivo informado: ${input.reason}\n\nSe precisar de esclarecimentos, responda a este email ou entre em contato com o suporte Flance.`,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>Atualizacao da sua conta Flance</h2><p>Ola, ${escapeHtml(input.name)}.</p><p>Sua conta/anuncio foi <strong>${escapeHtml(input.action)}</strong>.</p>${input.itemLabel ? `<p>${escapeHtml(input.itemLabel)}</p>` : ""}<p><strong>Motivo informado:</strong></p><p>${escapeHtml(input.reason).replace(/\n/g, "<br>")}</p><p>Se precisar de esclarecimentos, responda a este email ou entre em contato com o suporte Flance.</p></div>`,
      });
      return "SENT";
    } catch {
      return "FAILED";
    }
  }
}