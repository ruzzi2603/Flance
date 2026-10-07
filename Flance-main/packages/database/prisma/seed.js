const { PrismaClient, Role, JobStatus } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { config } = require("dotenv");
const path = require("path");

config({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);

  const client = await prisma.user.upsert({
    where: { email: "client@flance.dev" },
    update: {},
    create: {
      email: "client@flance.dev",
      password: passwordHash,
      name: "Flance Client",
      role: Role.CLIENT,
      bio: "Founder procurando talentos premium.",
    },
  });

  const freelancer = await prisma.user.upsert({
    where: { email: "freelancer@flance.dev" },
    update: {},
    create: {
      email: "freelancer@flance.dev",
      password: passwordHash,
      name: "Flance Freelancer",
      role: Role.FREELANCER,
      bio: "Especialista fullstack com foco em IA.",
      xp: 1200,
      level: 5,
    },
  });

  const job = await prisma.job.upsert({
    where: { id: "seed-job-flance" },
    update: {},
    create: {
      id: "seed-job-flance",
      title: "Landing page de alto impacto para Flance",
      description:
        "Criar uma landing page moderna, com foco em conversão, animações suaves e seções de prova social.",
      budget: "2500.00",
      status: JobStatus.OPEN,
      clientId: client.id,
      category: "Design & Frontend",
    },
  });

  await prisma.proposal.upsert({
    where: {
      freelancerId_jobId: {
        freelancerId: freelancer.id,
        jobId: job.id,
      },
    },
    update: {},
    create: {
      text: "Posso entregar em 5 dias com design premium e animações.",
      bidAmount: "2400.00",
      aiScore: 0.92,
      freelancerId: freelancer.id,
      jobId: job.id,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
