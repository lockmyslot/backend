import { config as loadEnv } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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
    `CRITICAL SAFETY CHECK: E2E tests attempted to run against non-test database: ${dbUrl}`,
  );
}
