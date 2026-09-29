import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { CompanyReviewInput } from "./schemas/company-review.schema";

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  bannedAt?: Date | null;
  banReason?: string | null;
  emailVerifiedAt?: Date | null;
  bio?: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  needs?: string;
  companyEnabled?: boolean;
  companyName?: string;
  companyCnpj?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyCity?: string;
  companyState?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyInstagram?: string;
  companyWhatsapp?: string;
  companyEmail?: string;
  companyHours?: string;
  companyPhotos?: string[];
  companyIsOnline?: boolean;
  companyIsPhysical?: boolean;
  companyViews?: number;
  planTier?: string;
  planStartedAt?: Date;
  planRenewsAt?: Date;
}

export interface PublicFreelancerProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  bio?: string;
}

export interface PublicCompanyProfile {
  id: string;
  ownerId: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  bio?: string;
  companyName?: string;
  companyDescription?: string;
  companyLocation?: string;
  companyCity?: string;
  companyState?: string;
  companyAddress?: string;
  companyWebsite?: string;
  companyInstagram?: string;
  companyWhatsapp?: string;
  companyEmail?: string;
  companyHours?: string;
  companyPhotos?: string[];
  companyIsOnline?: boolean;
  companyIsPhysical?: boolean;
  companyViews?: number;
  planTier?: string;
  averageRating: number;
  reviewCount: number;
  qualifiedReviewCount: number;
  isTrusted: boolean;
  reviewMedal: "bronze" | "silver" | "gold" | null;
}

export interface CompanyReviewSummary {
  id: string;
  rating: number;
  comment?: string;
  author: { id: string; name: string; avatarUrl?: string };
  createdAt: string;
}

export interface PublicUserProfile {
  id: string;
  name: string;
  avatarUrl?: string;
  headline?: string;
  services?: string;
  servicesTags?: string[];
  bio?: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { status: "ok" };
  }

  async createUser(input: {
    email: string;
    password: string;
    name: string;
    role: Role;
    bio?: string;
    avatarUrl?: string;
    headline?: string;
    services?: string;
    servicesTags?: string[];
    needs?: string;
    companyEnabled?: boolean;
    companyName?: string;
    companyCnpj?: string;
    companyDescription?: string;
    companyLocation?: string;
    companyCity?: string;
    companyState?: string;
    companyAddress?: string;
    companyWebsite?: string;
    companyInstagram?: string;
    companyWhatsapp?: string;
    companyEmail?: string;
    companyHours?: string;
    companyPhotos?: string[];
    companyIsOnline?: boolean;
    companyIsPhysical?: boolean;
    planTier?: "FREE" | "BASIC" | "PRO" | "PREMIUM";
  }): Promise<Omit<UserEntity, "passwordHash">> {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const normalizedTags = this.normalizeTags(input.servicesTags);
    const normalizedCnpj = this.normalizeCnpj(input.companyCnpj);
    const normalizedInstagram = this.normalizeInstagram(input.companyInstagram);
    const normalizedWhatsapp = this.normalizeWhatsapp(input.companyWhatsapp);
    const normalizedEmail = this.normalizeEmail(input.companyEmail);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        password: passwordHash,
        name: input.name,
        role: input.role,
        bio: input.bio,
        avatarUrl: input.avatarUrl,
        headline: input.headline,
        services: input.services,
        servicesTags: normalizedTags,
        needs: input.needs,
        companyEnabled: input.companyEnabled ?? false,
        companyName: input.companyName,
        companyCnpj: normalizedCnpj,
        companyDescription: input.companyDescription,
        companyLocation: input.companyLocation,
        companyCity: input.companyCity,
        companyState: input.companyState,
        companyAddress: input.companyAddress,
        companyWebsite: input.companyWebsite,
        companyInstagram: normalizedInstagram,
        companyWhatsapp: normalizedWhatsapp,
        companyEmail: normalizedEmail,
        companyHours: input.companyHours,
        companyPhotos: input.companyPhotos ?? [],
        companyIsOnline: input.companyIsOnline ?? true,
        companyIsPhysical: input.companyIsPhysical ?? false,
        planTier: input.planTier,
      },
    });

    return this.toPublicUser({
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      name: user.name,
      role: user.role,
      bio: user.bio ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      needs: user.needs ?? undefined,
      companyEnabled: user.companyEnabled ?? undefined,
      companyName: user.companyName ?? undefined,
      companyCnpj: user.companyCnpj ?? undefined,
      companyDescription: user.companyDescription ?? undefined,
      companyLocation: user.companyLocation ?? undefined,
      companyCity: user.companyCity ?? undefined,
      companyState: user.companyState ?? undefined,
      companyAddress: user.companyAddress ?? undefined,
      companyWebsite: user.companyWebsite ?? undefined,
      companyInstagram: user.companyInstagram ?? undefined,
      companyWhatsapp: user.companyWhatsapp ?? undefined,
      companyEmail: user.companyEmail ?? undefined,
      companyHours: user.companyHours ?? undefined,
      companyPhotos: user.companyPhotos ?? [],
      companyIsOnline: user.companyIsOnline ?? undefined,
      companyIsPhysical: user.companyIsPhysical ?? undefined,
      companyViews: user.companyViews ?? undefined,
      planTier: user.planTier ?? undefined,
      planStartedAt: user.planStartedAt ?? undefined,
      planRenewsAt: user.planRenewsAt ?? undefined,
    });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        bannedAt: true,
        banReason: true,
        emailVerifiedAt: true,
        bio: true,
        avatarUrl: true,
        headline: true,
        services: true,
        servicesTags: true,
        needs: true,
        companyEnabled: true,
        companyName: true,
        companyCnpj: true,
        companyDescription: true,
        companyLocation: true,
        companyCity: true,
        companyState: true,
        companyAddress: true,
        companyWebsite: true,
        companyInstagram: true,
        companyWhatsapp: true,
        companyEmail: true,
        companyHours: true,
        companyPhotos: true,
        companyIsOnline: true,
        companyIsPhysical: true,
        companyViews: true,
        planTier: true,
        planStartedAt: true,
        planRenewsAt: true,
      },
    });

    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      name: user.name,
      role: user.role,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
      emailVerifiedAt: user.emailVerifiedAt,
      bio: user.bio ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      needs: user.needs ?? undefined,
      companyEnabled: user.companyEnabled ?? undefined,
      companyName: user.companyName ?? undefined,
      companyCnpj: user.companyCnpj ?? undefined,
      companyDescription: user.companyDescription ?? undefined,
      companyLocation: user.companyLocation ?? undefined,
      companyCity: user.companyCity ?? undefined,
      companyState: user.companyState ?? undefined,
      companyAddress: user.companyAddress ?? undefined,
      companyWebsite: user.companyWebsite ?? undefined,
      companyInstagram: user.companyInstagram ?? undefined,
      companyWhatsapp: user.companyWhatsapp ?? undefined,
      companyEmail: user.companyEmail ?? undefined,
      companyHours: user.companyHours ?? undefined,
      companyPhotos: user.companyPhotos ?? [],
      companyIsOnline: user.companyIsOnline ?? undefined,
      companyIsPhysical: user.companyIsPhysical ?? undefined,
      companyViews: user.companyViews ?? undefined,
      planTier: user.planTier ?? undefined,
      planStartedAt: user.planStartedAt ?? undefined,
      planRenewsAt: user.planRenewsAt ?? undefined,
    };
  }

  async findById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        role: true,
        bannedAt: true,
        banReason: true,
        emailVerifiedAt: true,
        bio: true,
        avatarUrl: true,
        headline: true,
        services: true,
        servicesTags: true,
        needs: true,
        companyEnabled: true,
        companyName: true,
        companyCnpj: true,
        companyDescription: true,
        companyLocation: true,
        companyCity: true,
        companyState: true,
        companyAddress: true,
        companyWebsite: true,
        companyInstagram: true,
        companyWhatsapp: true,
        companyEmail: true,
        companyHours: true,
        companyPhotos: true,
        companyIsOnline: true,
        companyIsPhysical: true,
        companyViews: true,
        planTier: true,
        planStartedAt: true,
        planRenewsAt: true,
      },
    });

    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      name: user.name,
      role: user.role,
      bannedAt: user.bannedAt,
      banReason: user.banReason,
      emailVerifiedAt: user.emailVerifiedAt,
      bio: user.bio ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      needs: user.needs ?? undefined,
      companyEnabled: user.companyEnabled ?? undefined,
      companyName: user.companyName ?? undefined,
      companyCnpj: user.companyCnpj ?? undefined,
      companyDescription: user.companyDescription ?? undefined,
      companyLocation: user.companyLocation ?? undefined,
      companyCity: user.companyCity ?? undefined,
      companyState: user.companyState ?? undefined,
      companyAddress: user.companyAddress ?? undefined,
      companyWebsite: user.companyWebsite ?? undefined,
      companyInstagram: user.companyInstagram ?? undefined,
      companyWhatsapp: user.companyWhatsapp ?? undefined,
      companyEmail: user.companyEmail ?? undefined,
      companyHours: user.companyHours ?? undefined,
      companyPhotos: user.companyPhotos ?? [],
      companyIsOnline: user.companyIsOnline ?? undefined,
      companyIsPhysical: user.companyIsPhysical ?? undefined,
      companyViews: user.companyViews ?? undefined,
      planTier: user.planTier ?? undefined,
      planStartedAt: user.planStartedAt ?? undefined,
      planRenewsAt: user.planRenewsAt ?? undefined,
    };
  }

  toPublicUser(user: UserEntity): Omit<UserEntity, "passwordHash" | "bannedAt" | "banReason" | "emailVerifiedAt"> {
    const {
      passwordHash: _passwordHash,
      bannedAt: _bannedAt,
      banReason: _banReason,
      emailVerifiedAt: _emailVerifiedAt,
      ...publicUser
    } = user;
    return publicUser;
  }

  async updateProfile(
    userId: string,
    input: {
      name?: string;
      avatarUrl?: string;
      bio?: string;
      headline?: string;
      services?: string;
      servicesTags?: string[];
      needs?: string;
      role?: Role;
      companyEnabled?: boolean;
      companyName?: string;
      companyCnpj?: string;
      companyDescription?: string;
      companyLocation?: string;
      companyCity?: string;
      companyState?: string;
      companyAddress?: string;
      companyWebsite?: string;
      companyInstagram?: string;
      companyWhatsapp?: string;
      companyEmail?: string;
      companyHours?: string;
      companyPhotos?: string[];
      companyIsOnline?: boolean;
      companyIsPhysical?: boolean;
      planTier?: "FREE" | "BASIC" | "PRO" | "PREMIUM";
    },
  ): Promise<Omit<UserEntity, "passwordHash">> {
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const nextRole =
      input.role === "FREELANCER" && current?.role !== "FREELANCER" ? "FREELANCER" : undefined;
    const normalizedCnpj = this.normalizeCnpj(input.companyCnpj);
    const normalizedInstagram = this.normalizeInstagram(input.companyInstagram);
    const normalizedWhatsapp = this.normalizeWhatsapp(input.companyWhatsapp);
    const normalizedEmail = this.normalizeEmail(input.companyEmail);
    const normalizedAddress = this.normalizeOptional(input.companyAddress);
    const normalizedPhotos = input.companyPhotos ?? undefined;
    const maxPhotos = this.maxPhotosForPlan(input.planTier);

    if (normalizedPhotos && maxPhotos && normalizedPhotos.length > maxPhotos) {
      throw new BadRequestException(`Limite de ${maxPhotos} fotos para o plano selecionado.`);
    }

    await this.ensureCompanyDataUnique(userId, {
      companyCnpj: normalizedCnpj,
      companyAddress: normalizedAddress,
      companyInstagram: normalizedInstagram,
      companyWhatsapp: normalizedWhatsapp,
      companyEmail: normalizedEmail,
    });

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: this.normalizeOptionalName(input.name),
        avatarUrl: this.normalizeOptional(input.avatarUrl),
        bio: this.normalizeOptional(input.bio),
        headline: this.normalizeOptional(input.headline),
        services: this.normalizeOptional(input.services),
        servicesTags: this.normalizeTags(input.servicesTags),
        needs: this.normalizeOptional(input.needs),
        role: nextRole,
        companyEnabled: input.companyEnabled ?? undefined,
        companyName: this.normalizeOptional(input.companyName),
        companyCnpj: normalizedCnpj,
        companyDescription: this.normalizeOptional(input.companyDescription),
        companyLocation: this.normalizeOptional(input.companyLocation),
        companyCity: this.normalizeOptional(input.companyCity),
        companyState: this.normalizeOptional(input.companyState),
        companyAddress: normalizedAddress,
        companyWebsite: this.normalizeOptional(input.companyWebsite),
        companyInstagram: normalizedInstagram,
        companyWhatsapp: normalizedWhatsapp,
        companyEmail: normalizedEmail,
        companyHours: this.normalizeOptional(input.companyHours),
        companyPhotos: normalizedPhotos,
        companyIsOnline: input.companyIsOnline ?? undefined,
        companyIsPhysical: input.companyIsPhysical ?? undefined,
        planTier: input.planTier ?? undefined,
      },
    });

    return this.toPublicUser({
      id: updated.id,
      email: updated.email,
      passwordHash: updated.password,
      name: updated.name,
      role: updated.role,
      bio: updated.bio ?? undefined,
      avatarUrl: updated.avatarUrl ?? undefined,
      headline: updated.headline ?? undefined,
      services: updated.services ?? undefined,
      servicesTags: updated.servicesTags ?? [],
      needs: updated.needs ?? undefined,
      companyEnabled: updated.companyEnabled ?? undefined,
      companyName: updated.companyName ?? undefined,
      companyCnpj: updated.companyCnpj ?? undefined,
      companyDescription: updated.companyDescription ?? undefined,
      companyLocation: updated.companyLocation ?? undefined,
      companyCity: updated.companyCity ?? undefined,
      companyState: updated.companyState ?? undefined,
      companyAddress: updated.companyAddress ?? undefined,
      companyWebsite: updated.companyWebsite ?? undefined,
      companyInstagram: updated.companyInstagram ?? undefined,
      companyWhatsapp: updated.companyWhatsapp ?? undefined,
      companyEmail: updated.companyEmail ?? undefined,
      companyHours: updated.companyHours ?? undefined,
      companyPhotos: updated.companyPhotos ?? [],
      companyIsOnline: updated.companyIsOnline ?? undefined,
      companyIsPhysical: updated.companyIsPhysical ?? undefined,
      companyViews: updated.companyViews ?? undefined,
      planTier: updated.planTier ?? undefined,
      planStartedAt: updated.planStartedAt ?? undefined,
      planRenewsAt: updated.planRenewsAt ?? undefined,
    });
  }

  async updatePassword(userId: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: passwordHash },
    });
  }

  private normalizeOptional(value?: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeOptionalName(value?: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private normalizeTags(tags?: string[]) {
    if (!tags) return undefined;
    const cleaned = Array.from(
      new Set(tags.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0)),
    ).slice(0, 3);
    return cleaned;
  }

  private normalizeCnpj(value?: string) {
    if (value === undefined) return undefined;
    const digits = value.replace(/\D/g, "");
    return digits.length > 0 ? digits : null;
  }

  private normalizeInstagram(value?: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim().toLowerCase().replace(/^@/, "");
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeWhatsapp(value?: string) {
    if (value === undefined) return undefined;
    const digits = value.replace(/\D/g, "");
    return digits.length > 0 ? digits : null;
  }

  private normalizeEmail(value?: string) {
    if (value === undefined) return undefined;
    const trimmed = value.trim().toLowerCase();
    return trimmed.length > 0 ? trimmed : null;
  }

  private maxPhotosForPlan(plan?: "FREE" | "BASIC" | "PRO" | "PREMIUM") {
    if (!plan) return undefined;
    if (plan === "FREE") return 3;
    if (plan === "BASIC") return 6;
    if (plan === "PRO") return 10;
    return 20;
  }

  private async ensureCompanyDataUnique(
    userId: string,
    input: {
      companyCnpj?: string | null;
      companyAddress?: string | null;
      companyInstagram?: string | null;
      companyWhatsapp?: string | null;
      companyEmail?: string | null;
    },
  ) {
    const checks: Array<{ where: Prisma.UserWhereInput; message: string }> = [];

    if (input.companyCnpj) {
      checks.push({
        where: { companyCnpj: input.companyCnpj },
        message: "Este CNPJ ja foi cadastrado.",
      });
    }
    if (input.companyAddress) {
      checks.push({
        where: { companyAddress: { equals: input.companyAddress, mode: "insensitive" } },
        message: "Este endereco ja foi cadastrado.",
      });
    }
    if (input.companyInstagram) {
      checks.push({
        where: { companyInstagram: { equals: input.companyInstagram, mode: "insensitive" } },
        message: "Este Instagram ja foi cadastrado.",
      });
    }
    if (input.companyWhatsapp) {
      checks.push({
        where: { companyWhatsapp: input.companyWhatsapp },
        message: "Este WhatsApp ja foi cadastrado.",
      });
    }
    if (input.companyEmail) {
      checks.push({
        where: { companyEmail: { equals: input.companyEmail, mode: "insensitive" } },
        message: "Este email comercial ja foi cadastrado.",
      });
    }

    for (const check of checks) {
      const existing = await this.prisma.user.findFirst({
        where: {
          id: { not: userId },
          companyEnabled: true,
          ...check.where,
        },
        select: { id: true },
      });
      if (existing) {
        throw new BadRequestException(check.message);
      }
    }
  }

  async listFreelancers(query?: string, limit = 40, offset = 0): Promise<PublicFreelancerProfile[]> {
    const search = query?.trim();
    const users = search
      ? await this.searchFreelancers(search, limit, offset)
      : await this.prisma.user.findMany({
          where: { role: "FREELANCER" as const },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            headline: true,
            services: true,
            servicesTags: true,
            bio: true,
          },
        });

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      bio: user.bio ?? undefined,
    }));
  }

  async getFreelancerById(id: string): Promise<PublicFreelancerProfile | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, role: "FREELANCER" },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        headline: true,
        services: true,
        servicesTags: true,
        bio: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      bio: user.bio ?? undefined,
    };
  }

  async listCompanies(query?: string, limit = 40, offset = 0): Promise<PublicCompanyProfile[]> {
    const search = query?.trim();
    const users = search
      ? await this.searchCompanies(search, limit, offset)
      : await this.prisma.user.findMany({
          where: { companyEnabled: true },
          take: limit,
          skip: offset,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            headline: true,
            services: true,
            servicesTags: true,
            bio: true,
            companyName: true,
            companyDescription: true,
            companyLocation: true,
            companyCity: true,
            companyState: true,
            companyAddress: true,
            companyWebsite: true,
            companyInstagram: true,
            companyWhatsapp: true,
            companyEmail: true,
            companyHours: true,
            companyPhotos: true,
            companyIsOnline: true,
            companyIsPhysical: true,
            companyViews: true,
            planTier: true,
          },
        });

    const summaries = await this.getReviewSummaries(users.map((user) => user.id));
    return users.map((user) => ({
      id: user.id,
      ownerId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      bio: user.bio ?? undefined,
      companyName: user.companyName ?? undefined,
      companyDescription: user.companyDescription ?? undefined,
      companyLocation: user.companyLocation ?? undefined,
      companyCity: user.companyCity ?? undefined,
      companyState: user.companyState ?? undefined,
      companyAddress: user.companyAddress ?? undefined,
      companyWebsite: user.companyWebsite ?? undefined,
      companyInstagram: user.companyInstagram ?? undefined,
      companyWhatsapp: user.companyWhatsapp ?? undefined,
      companyEmail: user.companyEmail ?? undefined,
      companyHours: user.companyHours ?? undefined,
      companyPhotos: user.companyPhotos ?? [],
      companyIsOnline: user.companyIsOnline ?? undefined,
      companyIsPhysical: user.companyIsPhysical ?? undefined,
      companyViews: user.companyViews ?? undefined,
      planTier: user.planTier ?? undefined,
      ...(summaries.get(user.id) ?? { averageRating: 0, reviewCount: 0, qualifiedReviewCount: 0, isTrusted: false, reviewMedal: null }),
    })).sort((left, right) =>
      Number(right.isTrusted) - Number(left.isTrusted) ||
      right.averageRating - left.averageRating ||
      right.reviewCount - left.reviewCount,
    );
  }

  async getCompanyById(id: string): Promise<PublicCompanyProfile | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, companyEnabled: true },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        headline: true,
        services: true,
        servicesTags: true,
        bio: true,
        companyName: true,
        companyDescription: true,
        companyLocation: true,
        companyCity: true,
        companyState: true,
        companyAddress: true,
        companyWebsite: true,
        companyInstagram: true,
        companyWhatsapp: true,
        companyEmail: true,
        companyHours: true,
        companyPhotos: true,
        companyIsOnline: true,
        companyIsPhysical: true,
        companyViews: true,
        planTier: true,
      },
    });

    if (!user) return null;

    const summary = (await this.getReviewSummaries([user.id])).get(user.id) ?? {
      averageRating: 0,
      reviewCount: 0,
      qualifiedReviewCount: 0,
      isTrusted: false,
      reviewMedal: null,
    };

    return {
      id: user.id,
      ownerId: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      bio: user.bio ?? undefined,
      companyName: user.companyName ?? undefined,
      companyDescription: user.companyDescription ?? undefined,
      companyLocation: user.companyLocation ?? undefined,
      companyCity: user.companyCity ?? undefined,
      companyState: user.companyState ?? undefined,
      companyAddress: user.companyAddress ?? undefined,
      companyWebsite: user.companyWebsite ?? undefined,
      companyInstagram: user.companyInstagram ?? undefined,
      companyWhatsapp: user.companyWhatsapp ?? undefined,
      companyEmail: user.companyEmail ?? undefined,
      companyHours: user.companyHours ?? undefined,
      companyPhotos: user.companyPhotos ?? [],
      companyIsOnline: user.companyIsOnline ?? undefined,
      companyIsPhysical: user.companyIsPhysical ?? undefined,
      companyViews: user.companyViews ?? undefined,
      planTier: user.planTier ?? undefined,
      ...summary,
    };
  }

  async listCompanyReviews(companyId: string): Promise<CompanyReviewSummary[]> {
    const company = await this.prisma.user.findFirst({ where: { id: companyId, companyEnabled: true }, select: { id: true } });
    if (!company) throw new NotFoundException("Company not found");

    const reviews = await this.prisma.companyReview.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return reviews.map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? undefined,
      author: { id: review.author.id, name: review.author.name, avatarUrl: review.author.avatarUrl ?? undefined },
      createdAt: review.createdAt.toISOString(),
    }));
  }

  async recordCompanyView(companyId: string, sessionId: string) {
    await this.ensureCompanyExists(companyId);
    const visit = await this.prisma.companyAnalyticsEvent.upsert({
      where: {
        companyId_sessionId_eventType_source: {
          companyId,
          sessionId,
          eventType: "VIEW",
          source: "profile",
        },
      },
      create: { companyId, sessionId, eventType: "VIEW", source: "profile" },
      update: {},
      select: { id: true },
    });
    return visit;
  }

  async updateCompanyViewDuration(companyId: string, visitId: string, durationSeconds: number) {
    await this.prisma.companyAnalyticsEvent.updateMany({
      where: { id: visitId, companyId, eventType: "VIEW" },
      data: { durationSeconds: Math.min(Math.max(durationSeconds, 0), 86_400) },
    });
  }

  async recordCompanyShare(companyId: string, sessionId: string, source: string) {
    await this.ensureCompanyExists(companyId);
    return this.prisma.companyAnalyticsEvent.upsert({
      where: {
        companyId_sessionId_eventType_source: {
          companyId,
          sessionId,
          eventType: "SHARE",
          source,
        },
      },
      create: { companyId, sessionId, eventType: "SHARE", source },
      update: {},
      select: { id: true },
    });
  }

  async getCompanyAnalytics(companyId: string, requesterId: string) {
    if (companyId !== requesterId) {
      throw new ForbiddenException("Only the company owner can view analytics");
    }
    await this.ensureCompanyExists(companyId);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - 29);

    const eventRows = await this.prisma.$queryRaw<Array<{
      day: Date;
      eventType: string;
      source: string;
      total: bigint;
      averageDuration: number | null;
    }>>(Prisma.sql`
      SELECT
        date_trunc('day', "createdAt")::date AS day,
        "eventType"::text AS "eventType",
        source,
        count(*)::bigint AS total,
        avg("durationSeconds") FILTER (WHERE "eventType" = 'VIEW') AS "averageDuration"
      FROM "CompanyAnalyticsEvent"
      WHERE "companyId" = ${companyId} AND "createdAt" >= ${startDate}
      GROUP BY 1, 2, 3
      ORDER BY 1 ASC
    `);

    const messageRows = await this.prisma.$queryRaw<Array<{
      day: Date;
      total: bigint;
    }>>(Prisma.sql`
      SELECT
        date_trunc('day', message."createdAt")::date AS day,
        count(*)::bigint AS total
      FROM "Message" AS message
      INNER JOIN "Conversation" AS conversation ON conversation.id = message."conversationId"
      WHERE conversation."freelancerId" = ${companyId}
        AND conversation."jobId" IS NULL
        AND message."senderId" <> ${companyId}
        AND message."createdAt" >= ${startDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `);
    const contactRows = await this.prisma.$queryRaw<Array<{ people: bigint }>>(Prisma.sql`
      SELECT count(DISTINCT message."senderId")::bigint AS people
      FROM "Message" AS message
      INNER JOIN "Conversation" AS conversation ON conversation.id = message."conversationId"
      WHERE conversation."freelancerId" = ${companyId}
        AND conversation."jobId" IS NULL
        AND message."senderId" <> ${companyId}
        AND message."createdAt" >= ${startDate}
    `);

    const daily = new Map<string, { date: string; views: number; messages: number; shares: number }>();
    for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
      const date = new Date(startDate);
      date.setUTCDate(startDate.getUTCDate() + dayOffset);
      const key = date.toISOString().slice(0, 10);
      daily.set(key, { date: key, views: 0, messages: 0, shares: 0 });
    }

    let views = 0;
    let shares = 0;
    let durationTotal = 0;
    let durationVisits = 0;
    const shareSources = new Map<string, number>();
    for (const row of eventRows) {
      const key = new Date(row.day).toISOString().slice(0, 10);
      const point = daily.get(key);
      const count = Number(row.total);
      if (row.eventType === "VIEW") {
        views += count;
        durationTotal += (row.averageDuration ?? 0) * count;
        durationVisits += count;
        if (point) point.views += count;
      } else {
        shares += count;
        shareSources.set(row.source, (shareSources.get(row.source) ?? 0) + count);
        if (point) point.shares += count;
      }
    }

    let messages = 0;
    for (const row of messageRows) {
      const point = daily.get(new Date(row.day).toISOString().slice(0, 10));
      const count = Number(row.total);
      messages += count;
      if (point) point.messages += count;
    }
    const peopleContacted = Number(contactRows[0]?.people ?? 0);

    return {
      periodDays: 30,
      views,
      averageDurationSeconds: durationVisits ? Math.round(durationTotal / durationVisits) : 0,
      messages,
      peopleContacted,
      shares,
      shareSources: Array.from(shareSources, ([source, count]) => ({ source, count })),
      daily: Array.from(daily.values()),
    };
  }

  private async ensureCompanyExists(companyId: string) {
    const company = await this.prisma.user.findFirst({
      where: { id: companyId, companyEnabled: true },
      select: { id: true },
    });
    if (!company) throw new NotFoundException("Company not found");
    return company;
  }

  async upsertCompanyReview(companyId: string, authorId: string, input: CompanyReviewInput) {
    const company = await this.prisma.user.findFirst({ where: { id: companyId, companyEnabled: true }, select: { id: true } });
    if (!company) throw new NotFoundException("Company not found");
    if (companyId === authorId) throw new ForbiddenException("You cannot review your own company");

    const review = await this.prisma.companyReview.upsert({
      where: { companyId_authorId: { companyId, authorId } },
      create: { companyId, authorId, rating: input.rating, comment: input.comment || null },
      update: { rating: input.rating, comment: input.comment || null },
      select: { id: true, rating: true, comment: true, createdAt: true, author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment ?? undefined,
      author: { id: review.author.id, name: review.author.name, avatarUrl: review.author.avatarUrl ?? undefined },
      createdAt: review.createdAt.toISOString(),
    };
  }

  private async getReviewSummaries(companyIds: string[]) {
    const summaries = new Map<string, {
      averageRating: number;
      reviewCount: number;
      qualifiedReviewCount: number;
      isTrusted: boolean;
      reviewMedal: "bronze" | "silver" | "gold" | null;
    }>();
    if (!companyIds.length) return summaries;
    try {
      const [aggregates, qualifiedAggregates] = await Promise.all([
        this.prisma.companyReview.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds } },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        this.prisma.companyReview.groupBy({
          by: ["companyId"],
          where: { companyId: { in: companyIds, }, rating: { gte: 3 } },
          _count: { _all: true },
        }),
      ]);
      const qualifiedByCompany = new Map(qualifiedAggregates.map((aggregate) => [aggregate.companyId, aggregate._count._all]));
      for (const aggregate of aggregates) {
        const reviewCount = aggregate._count._all;
        const qualifiedReviewCount = qualifiedByCompany.get(aggregate.companyId) ?? 0;
        const averageRating = Number((aggregate._avg.rating ?? 0).toFixed(1));
        const reviewMedal = qualifiedReviewCount >= 300 ? "gold" : qualifiedReviewCount >= 100 ? "silver" : qualifiedReviewCount > 0 ? "bronze" : null;
        summaries.set(aggregate.companyId, {
          averageRating,
          reviewCount,
          qualifiedReviewCount,
          isTrusted: reviewCount >= 3 && averageRating >= 4,
          reviewMedal,
        });
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
        return new Map(companyIds.map((companyId) => [companyId, {
          averageRating: 0,
          reviewCount: 0,
          qualifiedReviewCount: 0,
          isTrusted: false,
          reviewMedal: null,
        }]));
      }
      throw error;
    }
    for (const companyId of companyIds) {
      if (!summaries.has(companyId)) summaries.set(companyId, {
        averageRating: 0,
        reviewCount: 0,
        qualifiedReviewCount: 0,
        isTrusted: false,
        reviewMedal: null,
      });
    }
    return summaries;
  }

  async getPublicProfileById(id: string): Promise<PublicUserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        headline: true,
        services: true,
        servicesTags: true,
        bio: true,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
      headline: user.headline ?? undefined,
      services: user.services ?? undefined,
      servicesTags: user.servicesTags ?? [],
      bio: user.bio ?? undefined,
    };
  }

  private async searchFreelancers(search: string, limit: number, offset: number) {
    const like = `%${search}%`;
    try {
      return await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          avatarUrl: string | null;
          headline: string | null;
          services: string | null;
          servicesTags: string[] | null;
          bio: string | null;
        }>
      >(
        Prisma.sql`
        SELECT
          "id",
          "name",
          "avatarUrl",
          "headline",
          "services",
          "servicesTags",
          "bio"
        FROM "User"
        WHERE "role" = 'FREELANCER'
          AND (
            unaccent(lower(coalesce("name", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("headline", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("services", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("bio", ''))) LIKE unaccent(lower(${like}))
            OR EXISTS (
              SELECT 1
              FROM unnest(coalesce("servicesTags", ARRAY[]::text[])) tag
              WHERE unaccent(lower(tag)) LIKE unaccent(lower(${like}))
            )
          )
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `,
      );
    } catch {
      return this.prisma.user.findMany({
        where: {
          role: "FREELANCER" as const,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { headline: { contains: search, mode: "insensitive" as const } },
            { services: { contains: search, mode: "insensitive" as const } },
            { bio: { contains: search, mode: "insensitive" as const } },
            { servicesTags: { hasSome: search.toLowerCase().split(/\s+/).filter(Boolean) } },
          ],
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          headline: true,
          services: true,
          servicesTags: true,
          bio: true,
        },
      });
    }
  }

  private async searchCompanies(search: string, limit: number, offset: number) {
    const like = `%${search}%`;
    try {
      return await this.prisma.$queryRaw<
        Array<{
          id: string;
          name: string;
          avatarUrl: string | null;
          headline: string | null;
          services: string | null;
          servicesTags: string[] | null;
          bio: string | null;
          companyName: string | null;
          companyDescription: string | null;
          companyLocation: string | null;
          companyCity: string | null;
          companyState: string | null;
          companyAddress: string | null;
          companyWebsite: string | null;
          companyInstagram: string | null;
          companyWhatsapp: string | null;
          companyEmail: string | null;
          companyHours: string | null;
          companyPhotos: string[] | null;
          companyIsOnline: boolean | null;
          companyIsPhysical: boolean | null;
          companyViews: number | null;
          planTier: string | null;
        }>
      >(
        Prisma.sql`
        SELECT
          "id",
          "name",
          "avatarUrl",
          "headline",
          "services",
          "servicesTags",
          "bio",
          "companyName",
          "companyDescription",
          "companyLocation",
          "companyCity",
          "companyState",
          "companyAddress",
          "companyWebsite",
          "companyInstagram",
          "companyWhatsapp",
          "companyEmail",
          "companyHours",
          "companyPhotos",
          "companyIsOnline",
          "companyIsPhysical",
          "companyViews",
          "planTier"
        FROM "User"
        WHERE "companyEnabled" = true
          AND (
            unaccent(lower(coalesce("name", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyName", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyDescription", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyLocation", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyCity", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyState", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("companyAddress", ''))) LIKE unaccent(lower(${like}))
            OR unaccent(lower(coalesce("services", ''))) LIKE unaccent(lower(${like}))
            OR EXISTS (
              SELECT 1
              FROM unnest(coalesce("servicesTags", ARRAY[]::text[])) tag
              WHERE unaccent(lower(tag)) LIKE unaccent(lower(${like}))
            )
          )
        ORDER BY "createdAt" DESC
        LIMIT ${limit} OFFSET ${offset};
      `,
      );
    } catch {
      return this.prisma.user.findMany({
        where: {
          companyEnabled: true,
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { companyName: { contains: search, mode: "insensitive" as const } },
            { companyDescription: { contains: search, mode: "insensitive" as const } },
            { companyLocation: { contains: search, mode: "insensitive" as const } },
            { companyCity: { contains: search, mode: "insensitive" as const } },
            { companyState: { contains: search, mode: "insensitive" as const } },
            { companyAddress: { contains: search, mode: "insensitive" as const } },
            { services: { contains: search, mode: "insensitive" as const } },
            { servicesTags: { hasSome: search.toLowerCase().split(/\s+/).filter(Boolean) } },
          ],
        },
        take: limit,
        skip: offset,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          headline: true,
          services: true,
          servicesTags: true,
          bio: true,
          companyName: true,
          companyDescription: true,
          companyLocation: true,
          companyCity: true,
          companyState: true,
          companyAddress: true,
          companyWebsite: true,
          companyInstagram: true,
          companyWhatsapp: true,
          companyEmail: true,
          companyHours: true,
          companyPhotos: true,
          companyIsOnline: true,
          companyIsPhysical: true,
          companyViews: true,
          planTier: true,
        },
      });
    }
  }
}
