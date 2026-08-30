import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

const ENV_FILE = '.env.test.local';

async function truncateAll(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "bookings" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "booking_rules" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "resources" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "group_members" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "groups" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE;`);
}

export default async function globalSetup() {
  loadEnv({ path: ENV_FILE, override: true });

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
    await truncateAll(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
