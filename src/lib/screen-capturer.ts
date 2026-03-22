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

      // dismiss banners (basic heuristic)
      // --------------------------------------------------------------------------------------------------------
      console.log(`  dismissing banners...`)

      let counter = 0
      const locators = [
        'button:has-text("Autoriser tous les cookies")', // https://www.afp.com/
        'button:has-text("ACCETTA E CONTINUA")', // https://www.ansa.it/
        'button:has-text("Prano të gjitha")', // https://kosovapress.com/
        'div.closeSubscribPopUp', // https://kosovapress.com/
        'button:has-text("OK")', // https://www.ntb.no/
        'button:has-text("Tillåt alla")', // https://tt.se/
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // many
      ].join()

      let acceptButtons = page.locator(locators)
      while ((await acceptButtons.count()) > 0 && counter < 5) {
        counter++
        await acceptButtons
          .first()
          .click({ timeout: 5000 })
          .catch(() => {})

        acceptButtons = page.locator(locators)
      }

      // save image
      // --------------------------------------------------------------------------------------------------------
      console.log(`  saving image...`)
      const screenshotBuffer = await page.screenshot({ fullPage: true })
      await this.storage.saveScreenshot(`${dateStr}/${slug}.png`, screenshotBuffer)

      // extract text using AI
      // --------------------------------------------------------------------------------------------------------
      console.log(`  extracting text...`)
      const structuredMarkdown = await this.structurer.structureAndTranslate(screenshotBuffer, site.country)
      await this.storage.saveText(`${dateStr}/${slug}.md`, structuredMarkdown)
    } finally {
      await browser.close()
    }
  }
}
