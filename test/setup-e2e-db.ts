import { config as loadEnv } from 'dotenv';
import { execSync } from 'child_process';

loadEnv({ path: '.env.test.local', override: true });

const url = process.env.DATABASE_URL as string;
const base = url.split('?')[0];
const dbName = base.split('/').pop() as string;

try {
  execSync(`dropdb --if-exists ${dbName}`, { stdio: 'ignore' });
} catch {
  // ignore
}

try {
  execSync(`createdb --owner=lockmyslot ${dbName}`, { stdio: 'ignore' });
} catch (err) {
  console.error('Failed to create test database:', (err as Error).message);
  process.exit(1);
}

execSync('npx prisma migrate deploy', { stdio: 'inherit' });
