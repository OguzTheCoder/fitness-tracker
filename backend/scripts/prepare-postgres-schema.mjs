import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.resolve(__dirname, '..', 'prisma');
const sourcePath = path.join(prismaDir, 'schema.prisma');
const targetPath = path.join(prismaDir, 'schema.postgres.prisma');

const useDirectUrl = Boolean(process.env.DIRECT_URL && process.env.DIRECT_URL.trim().length > 0);

const source = fs.readFileSync(sourcePath, 'utf8');
const datasourceBlockPattern = /datasource\s+db\s*\{[\s\S]*?\}/;

if (!datasourceBlockPattern.test(source)) {
  throw new Error('schema.prisma içinde datasource db bloğu bulunamadı.');
}

const pgDatasource = useDirectUrl
  ? `datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  directUrl = env("DIRECT_URL")\n}`
  : `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`;

const header = `// Otomatik üretilir (kaynak: prisma/schema.prisma). Elle düzenlemeyin.\n\n`;
const transformed = header + source.replace(datasourceBlockPattern, pgDatasource);

fs.writeFileSync(targetPath, transformed, 'utf8');
console.log(
  `PostgreSQL şeması hazırlandı: ${path.relative(process.cwd(), targetPath)}${useDirectUrl ? ' (DIRECT_URL etkin)' : ''}`,
);
