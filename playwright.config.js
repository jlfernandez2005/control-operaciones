import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'node server/index.js',
    port: 3100,
    reuseExistingServer: true,
    timeout: 30000,
    env: {
      PORT: '3100',
      DB_PATH: './data/e2e.db',
      JWT_SECRET: 'e2e-secret',
      ADMIN_USER: 'admin',
      ADMIN_PASS: 'admin123',
      COOKIE_SECURE: 'false'
    }
  }
});