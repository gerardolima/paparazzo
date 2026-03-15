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
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })

      // Auto-dismiss common cookie banners (basic heuristic)
      const acceptButtons = page.locator(
        'button:has-text("Accept"), button:has-text("Agree"), button:has-text("I Accept")',
      )
      if ((await acceptButtons.count()) > 0) {
        await acceptButtons
          .first()
          .click({ timeout: 2000 })
          .catch(() => {})
      }

      const screenshotBuffer = await page.screenshot({ fullPage: true })
      await this.storage.saveScreenshot(`${dateStr}/screenshots/${siteName}.png`, screenshotBuffer)
    } finally {
      await browser.close()
    }
  }
}
