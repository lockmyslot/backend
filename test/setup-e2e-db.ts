import { config as loadEnv } from 'dotenv';
import { execSync } from 'child_process';
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

const url = process.env.DATABASE_URL as string;
if (!url || !url.includes('_test')) {
  console.error(`Refusing to drop non-test database: ${url}`);
  process.exit(1);
}

const base = url.split('?')[0];
const dbName = base.split('/').pop() as string;

try {
  execSync(`dropdb --if-exists ${dbName}`, { stdio: 'ignore' });
} catch {
  // ignore
}

try {
  execSync(`createdb ${dbName}`, { stdio: 'ignore' });
} catch (err) {
  console.error('Failed to create test database:', (err as Error).message);
  process.exit(1);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
