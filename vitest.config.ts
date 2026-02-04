import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/renderer/**'],
      thresholds: {
        // Target 80% coverage - current baseline to prevent regression
        // Increase these as more tests are added
        statements: 35,
        branches: 60,
        functions: 60,
        lines: 35
      }
    },
    setupFiles: ['tests/setup.ts'],
    testTimeout: 10000
  },
  resolve: {
    alias: {
      '@main': resolve(__dirname, 'src/main'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  }
})
