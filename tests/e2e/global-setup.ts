/**
 * Playwright Global Setup
 *
 * This file runs ONCE before any E2E tests execute.
 * It enforces test environment to prevent production database pollution.
 */

export default function globalSetup() {
  // Set test environment variables at the highest level
  process.env.NODE_ENV = 'test'
  process.env.TODOER_TEST_MODE = 'true'

  // Safety: Block any path that looks like production data
  process.env.TODOER_DATA_PATH = ''

  console.log('🧪 Playwright Global Setup: Test environment enforced')
  console.log('   NODE_ENV:', process.env.NODE_ENV)
  console.log('   TODOER_TEST_MODE:', process.env.TODOER_TEST_MODE)
}
