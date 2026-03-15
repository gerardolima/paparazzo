import { chromium } from 'playwright'
import type { Storage } from './storage/storage.ts'

export class ScreenCapturer {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  async capture(url: string, siteName: string, dateStr: string): Promise<void> {
    const browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

      // Auto-dismiss common cookie banners (basic heuristic)
      const acceptButtons = page.locator(
        'button:has-text("Accept"), button:has-text("Agree"), button:has-text("I Accept"), button:has-text("Confirm")',
      )
      if ((await acceptButtons.count()) > 0) {
        await acceptButtons
          .first()
          .click({ timeout: 2000 })
          .catch(() => {})
      }

      // Auto-dismiss common cookie banners (basic heuristic)
      const okButton = page.locator('button:has-text("OK")')
      if ((await okButton.count()) > 0) {
        await okButton
          .first()
          .click({ timeout: 2000 })
          .catch(() => {})
      }

      // handle image
      const screenshotBuffer = await page.screenshot({ fullPage: true })
      await this.storage.saveScreenshot(`${dateStr}/${siteName}.png`, screenshotBuffer)

      // handle text
      const extractedText = await page.evaluate(() => document.body.innerText)
      await this.storage.saveText(`${dateStr}/${siteName}.md`, extractedText)
    } finally {
      await browser.close()
    }
  }
}
