import { chromium } from 'playwright'
import type { AIClient } from './ai-client.ts'
import type { Site } from './config/sites.ts'
import { siteSlug } from './config/sites.ts'
import type { Storage } from './storage/storage.ts'

export class ScreenCapturer {
  private readonly storage: Storage
  private readonly structurer: AIClient

  constructor(storage: Storage, structurer: AIClient) {
    this.storage = storage
    this.structurer = structurer
  }

  async capture(site: Site, dateStr: string): Promise<void> {
    const slug = siteSlug(site)
    const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    })
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      console.log(`  opening site: ${site.url}...`)
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      // Auto-dismiss common cookie banners (basic heuristic)
      console.log(`  dismissing grdp banners...`)
      const acceptButtons = page.locator(
        'button:has-text("Accept"), button:has-text("Agree"), button:has-text("I Accept"), button:has-text("Confirm")',
      )
      if ((await acceptButtons.count()) > 0) {
        await acceptButtons
          .first()
          .click({ timeout: 2000 })
          .catch(() => { })
      }

      // Auto-dismiss common cookie banners (basic heuristic)
      const okButton = page.locator('button:has-text("OK")')
      if ((await okButton.count()) > 0) {
        await okButton
          .first()
          .click({ timeout: 2000 })
          .catch(() => { })
      }

      // handle image
      console.log(`  saving image...`)
      const screenshotBuffer = await page.screenshot({ fullPage: true })
      await this.storage.saveScreenshot(`${dateStr}/${slug}.png`, screenshotBuffer)

      // handle text via AI
      console.log(`  extracting text...`)
      const structuredMarkdown = await this.structurer.structureAndTranslate(screenshotBuffer, site.country)
      await this.storage.saveText(`${dateStr}/${slug}.md`, structuredMarkdown)
    } finally {
      await browser.close()
    }
  }
}
