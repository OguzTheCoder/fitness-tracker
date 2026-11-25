import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '..');
const testDbPath = path.join(backendRoot, 'prisma', 'test.db');

export default function globalSetup() {
  if (fs.existsSync(testDbPath)) {
    fs.rmSync(testDbPath, { force: true });
  }

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
    },
    stdio: 'pipe',
  });

  return () => {
    for (const suffix of ['', '-journal', '-shm', '-wal']) {
      const file = `${testDbPath}${suffix}`;
      if (fs.existsSync(file)) {
        fs.rmSync(file, { force: true });
      }
    }
  };
}
