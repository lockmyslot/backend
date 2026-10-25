import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const localEnv = path.resolve(__dirname, '../.env.test.local');
const testEnv = path.resolve(__dirname, '../.env.test');

if (fs.existsSync(localEnv)) {
  loadEnv({ path: localEnv, override: true });
} else if (fs.existsSync(testEnv)) {
  loadEnv({ path: testEnv, override: true });
} else {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://krissh@localhost/lockmyslot_test?host=/var/run/postgresql';
}

process.env.NODE_ENV = 'test';

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes('_test')) {
  throw new Error(
    `CRITICAL SAFETY CHECK: Refusing to run E2E setup/truncate against non-test database: ${dbUrl}`,
  );
}

async function truncateAll(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "group_invites" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "maintenance_tasks" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "bookings" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "booking_rules" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "resources" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "group_members" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "groups" CASCADE;`);
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "users" CASCADE;`);
}

export default async function globalSetup() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  try {
    await prisma.$connect();
    await truncateAll(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
