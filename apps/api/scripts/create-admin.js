require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") });

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "matheusruzzi8@gmail.com").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador Flance";

  if (!email) throw new Error("Set ADMIN_EMAIL or use the configured default administrator email.");
  if (!password) throw new Error("ADMIN_PASSWORD is required.");
  if (password.length < 14) throw new Error("ADMIN_PASSWORD must contain at least 14 characters.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      password: passwordHash,
      name,
      role: "ADMIN",
      companyEnabled: false,
      emailVerifiedAt: new Date(),
    },
    update: {
      password: passwordHash,
      name,
      role: "ADMIN",
      bannedAt: null,
      banReason: null,
      emailVerifiedAt: new Date(),
    },
  });

  console.log(`Administrator account configured for ${email}. Password stored as bcrypt hash.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });