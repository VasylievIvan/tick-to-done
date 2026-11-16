import { defineConfig } from '@playwright/test';

const devPort = 5199;
const productionPort = 5299;
// Browser tests play the fixed test rules, so tuning src/config/balance.ts never breaks them.
const testRulesEnv = { VITE_RULES: 'test' };
// A separate folder keeps the test-rules build away from dist/, which always holds the approved balance.
const productionOutDir = 'dist-e2e';

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
      env: testRulesEnv,
      url: `http://localhost:${devPort}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npm run build -- --outDir ${productionOutDir} && npm run preview -- --outDir ${productionOutDir} --port ${productionPort} --strictPort`,
      env: testRulesEnv,
      url: `http://localhost:${productionPort}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
