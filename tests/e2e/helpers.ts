import path from 'path'
import { _electron as electron, ElectronApplication } from '@playwright/test'
import type { Page } from '@playwright/test'

/** Standard Electron launch options for E2E tests */
export function getLaunchOptions() {
  const args = [path.join(__dirname, '../../out/main/index.js')]
  // GitHub Actions runners don't support the SUID sandbox
  if (process.env.CI) {
    args.unshift('--no-sandbox')
  }
  return {
    args,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      TODOER_TEST_MODE: 'true'
    }
  }
}

/** Launch Electron app with standard test options */
export async function launchElectron(): Promise<ElectronApplication> {
  return electron.launch(getLaunchOptions())
}

/** Open Quick Add modal reliably by blurring any focused input first */
export async function openQuickAdd(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.waitForTimeout(200)
  await page.keyboard.press('q')
  await page.waitForTimeout(500)
}
