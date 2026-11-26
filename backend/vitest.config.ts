import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/globalSetup.ts',
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'file:./test.db',
      JWT_SECRET: 'test-jwt-secret-key-at-least-32-characters-long',
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGIN: 'http://localhost:5173',
      FRONTEND_URL: 'http://localhost:5173',
      PASSWORD_RESET_TTL_MINUTES: '15',
    },
  },
});
