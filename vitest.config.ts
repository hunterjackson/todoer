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
      exclude: [
        'src/**/*.d.ts',
        'src/renderer/**',
        'src/preload/**',
        'src/main/index.ts',
        'src/main/menu.ts',
        'src/main/ipc/**',
        'src/main/mcp/**',
        'src/shared/types/**',
        'src/main/db/repositories/activityRepository.ts'
      ],
      thresholds: {
        // Current thresholds based on tested core business logic
        // Higher coverage on repositories (90%+), services under development
        // Excludes: renderer (UI), preload (bridge), ipc/mcp (integration points)
        statements: 68,
        branches: 70,
        functions: 80,
        lines: 68
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
