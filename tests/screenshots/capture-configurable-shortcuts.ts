/**
 * Capture screenshots for the Configurable Shortcuts PR (#4)
 * Run: npx tsx tests/screenshots/capture-configurable-shortcuts.ts
 */
import { _electron as electron } from 'playwright'
import path from 'path'
import fs from 'fs'

const outDir = path.join(__dirname, 'output')
fs.mkdirSync(outDir, { recursive: true })

async function main() {
  const app = await electron.launch({
    args: [path.join(__dirname, '../../out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'test', TODOER_TEST_MODE: 'true' }
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.waitForTimeout(1500)

  const screenshot = async (name: string) => {
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(outDir, `shortcuts-${name}.png`) })
    console.log(`  Captured: shortcuts-${name}.png`)
  }

  // --- Show keyboard shortcuts help dialog ---
  console.log('Opening keyboard shortcuts help...')
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.waitForTimeout(200)
  await page.keyboard.press('?')
  await page.waitForTimeout(500)
  await screenshot('01-shortcuts-help-dialog')

  // Close help dialog
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // --- Open Settings and navigate to Keyboard Shortcuts ---
  console.log('Opening settings...')
  const settingsBtn = page.locator('button:has-text("Settings")')
  await settingsBtn.click()
  await page.waitForTimeout(500)

  // Look for Keyboard Shortcuts section - scroll if needed
  const shortcutsSection = page.locator('text=Keyboard Shortcuts').first()
  if (await shortcutsSection.isVisible().catch(() => false)) {
    await shortcutsSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
  }
  await screenshot('02-settings-keyboard-section')

  // --- Click on a shortcut to edit it ---
  console.log('Editing a shortcut...')
  // Find a shortcut row and click it to enter edit mode
  const shortcutRows = page.locator('[data-shortcut-action]')
  const rowCount = await shortcutRows.count()
  if (rowCount > 0) {
    // Click the first shortcut to edit
    await shortcutRows.first().click()
    await page.waitForTimeout(500)
    await screenshot('03-editing-shortcut')

    // Press Escape to cancel editing
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  } else {
    // Try finding shortcut edit buttons
    const editBtns = page.locator('button:has-text("Click to change")')
    if (await editBtns.first().isVisible().catch(() => false)) {
      await editBtns.first().click()
      await page.waitForTimeout(500)
      await screenshot('03-editing-shortcut')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(300)
    }
  }

  // Scroll down to see more shortcuts
  const settingsDialog = page.locator('.fixed.inset-0').first()
  if (await settingsDialog.isVisible().catch(() => false)) {
    // Scroll within the settings dialog
    await page.mouse.wheel(0, 300)
    await page.waitForTimeout(300)
    await screenshot('04-shortcuts-list-scrolled')
  }

  // Close settings
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // --- Demonstrate Quick Add working with shortcut ---
  console.log('Demonstrating shortcut in action...')
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.waitForTimeout(200)
  await page.keyboard.press('q')
  await page.waitForTimeout(500)
  await screenshot('05-quick-add-via-shortcut')

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  console.log('Done! Screenshots saved to tests/screenshots/output/')
  await app.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
