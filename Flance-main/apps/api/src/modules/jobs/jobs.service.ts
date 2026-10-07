import { Injectable } from "@nestjs/common";
import type { JobStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { CreateJobInput } from "./schemas/jobs.schema";

export interface JobEntity {
  id: string;
  title: string;
  description: string;
  budgetType: "FIXED" | "RANGE" | "NEGOTIABLE";
  budget: number | null;
  budgetMin: number | null;
  budgetMax: number | null;
  category: string;
  status: JobStatus;
  clientId: string;
  clientName?: string;
  clientAvatarUrl?: string;
  createdAt: string;
}

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  health() {
    return { status: "ok" };
  }

  async findAll(query?: string, limit = 40, offset = 0): Promise<JobEntity[]> {
    const search = query?.trim();
    const jobs = await this.prisma.job.findMany({
      where: {
        status: "OPEN",
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    return jobs.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      budgetType: job.budgetType,
      budget: job.budget === null ? null : Number(job.budget),
      budgetMin: job.budgetMin === null ? null : Number(job.budgetMin),
      budgetMax: job.budgetMax === null ? null : Number(job.budgetMax),
      category: job.category,
      status: job.status,
      clientId: job.clientId,
      clientName: job.client?.name ?? undefined,
      clientAvatarUrl: job.client?.avatarUrl ?? undefined,
      createdAt: job.createdAt.toISOString(),
    }));
  }

  async findById(jobId: string): Promise<JobEntity | null> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: {
        client: {
          select: {
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!job) return null;

    return {
      id: job.id,
      title: job.title,
      description: job.description,
      budgetType: job.budgetType,
      budget: job.budget === null ? null : Number(job.budget),
      budgetMin: job.budgetMin === null ? null : Number(job.budgetMin),
      budgetMax: job.budgetMax === null ? null : Number(job.budgetMax),
      category: job.category,
      status: job.status,
      clientId: job.clientId,
      clientName: job.client?.name ?? undefined,
      clientAvatarUrl: job.client?.avatarUrl ?? undefined,
      createdAt: job.createdAt.toISOString(),
    };
  }

  async create(input: CreateJobInput, clientId: string): Promise<JobEntity> {
    const job = await this.prisma.job.create({
      data: {
        title: input.title,
        description: input.description,
        budgetType: input.budgetType,
        budget: input.budget ?? null,
        budgetMin: input.budgetMin ?? null,
        budgetMax: input.budgetMax ?? null,
        category: input.category,
        clientId,
      },
    });

    return {
      id: job.id,
      title: job.title,
      description: job.description,
      budgetType: job.budgetType,
      budget: job.budget === null ? null : Number(job.budget),
      budgetMin: job.budgetMin === null ? null : Number(job.budgetMin),
      budgetMax: job.budgetMax === null ? null : Number(job.budgetMax),
      category: job.category,
      status: job.status,
      clientId: job.clientId,
      createdAt: job.createdAt.toISOString(),
    };
  }
}

