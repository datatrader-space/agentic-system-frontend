import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'workflow-builder.spec.js',
  workers: 1,
  fullyParallel: false,
  timeout: 90000,
  expect: { timeout: 10000 },
  use: { baseURL: 'http://127.0.0.1:5177', headless: true, viewport: { width: 1440, height: 900 }, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/workflow', open: 'never' }]],
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort', url: 'http://127.0.0.1:5177', reuseExistingServer: !process.env.CI, timeout: 120000 },
})
