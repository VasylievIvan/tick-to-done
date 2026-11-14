import { defineConfig } from '@playwright/test';

const devPort = 5199;
const productionPort = 5299;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'dev', testIgnore: /production\.spec\.ts/, use: { baseURL: `http://localhost:${devPort}` } },
    { name: 'production', testMatch: /production\.spec\.ts/, use: { baseURL: `http://localhost:${productionPort}` } },
  ],
  webServer: [
    {
      command: `npm run dev -- --port ${devPort} --strictPort`,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build && npm run preview -- --port ${productionPort} --strictPort`,
      url: `http://localhost:${productionPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
