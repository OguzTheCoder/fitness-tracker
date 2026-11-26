import { createApp } from './app.js';
import { env } from './config/env.js';
import { ensureCoreFoodsSeeded } from './modules/foods/foods.seed.js';

const app = createApp();

ensureCoreFoodsSeeded()
  .catch((err) => {
    console.error('Çekirdek besin listesi yüklenirken hata oluştu:', err);
  })
  .finally(() => {
    app.listen(env.PORT, () => {
      console.log(`Backend sunucusu http://localhost:${env.PORT} adresinde çalışıyor.`);
    });
  });
