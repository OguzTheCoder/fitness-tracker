import { prisma } from '../src/config/prisma.js';
import { seedCoreExercises } from '../src/modules/exercises/exercises.seed.js';
import { seedCoreFoods } from '../src/modules/foods/foods.seed.js';

async function main() {
  const [foodCount, exerciseCount] = await Promise.all([seedCoreFoods(), seedCoreExercises()]);
  console.log(
    `Çekirdek veriler hazırlandı (${foodCount} besin, ${exerciseCount} egzersiz).`,
  );
}

main()
  .catch((err) => {
    console.error('Seed işlemi başarısız:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
