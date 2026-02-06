import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  // Global setup ensures test environment is enforced before any tests run
  globalSetup: './tests/e2e/global-setup.ts',
  testDir: './tests/e2e',
  fullyParallel: false, // Tests within a file share an Electron instance, so they run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : 4, // Run test files in parallel - each launches its own Electron with isolated in-memory DB
  reporter: 'html',
  timeout: 60000,
  expect: {
    timeout: process.env.CI ? 15000 : 5000
  },
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.spec\.ts/
    }
  ]
})
