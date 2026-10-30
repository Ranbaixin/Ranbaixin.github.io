import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: { baseURL: process.env.TEST_URL || 'http://127.0.0.1:4321', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
});
