import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Backend sunucusu http://localhost:${env.PORT} adresinde çalışıyor.`);
});
