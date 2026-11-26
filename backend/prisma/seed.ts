import { prisma } from '../src/config/prisma.js';
import { seedCoreFoods } from '../src/modules/foods/foods.seed.js';

async function main() {
  const count = await seedCoreFoods();
  console.log(`Çekirdek besin listesi hazırlandı (${count} besin).`);
}

main()
  .catch((err) => {
    console.error('Seed işlemi başarısız:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
