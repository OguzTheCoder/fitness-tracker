import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { ensureCoreExercisesSeeded } from './modules/exercises/exercises.seed.js';
import { ensureCoreFoodsSeeded } from './modules/foods/foods.seed.js';

const app = createApp();

async function startServer() {
  try {
    await Promise.all([ensureCoreFoodsSeeded(), ensureCoreExercisesSeeded()]);
  } catch (err) {
    console.error('Çekirdek veri listeleri yüklenirken hata oluştu:', err);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`Backend sunucusu http://localhost:${env.PORT} adresinde çalışıyor.`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} sinyali alındı, sunucu kapatılıyor...`);
    server.close(() => {
      prisma
        .$disconnect()
        .catch(() => {})
        .finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void startServer();
