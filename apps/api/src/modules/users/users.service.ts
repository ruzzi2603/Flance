import { BadRequestException, Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";

export interface UserEntity {
  id: string;
  email: string;
  passwordHash: string;
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

  toPublicUser(user: UserEntity): Omit<UserEntity, "passwordHash"> {
    const { passwordHash: _passwordHash, ...publicUser } = user;
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
    }));
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
    };
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
