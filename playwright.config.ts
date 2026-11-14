import { defineConfig } from '@playwright/test';

const port = 5199;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${port}`,
    channel: 'chrome',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
