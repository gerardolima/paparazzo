import { chromium } from 'playwright'
import type { AIClient } from './ai-client.ts'
import type { Site } from './data/sites.ts'
import type { Storage } from './storage/storage.ts'

const BLOCKED_DOMAINS = [
  'googlesyndication.com',
  'google-analytics.com',
  'googletagmanager.com',
  'googleadservices.com',
  'doubleclick.net',
  'adtrafficquality.google',
  'facebook.net',
  'facebook.com/tr',
]

export class ScreenCapturer {
  readonly #storage: Storage
  readonly #aiClient: AIClient

  constructor(storage: Storage, aiClient: AIClient) {
    this.#storage = storage
    this.#aiClient = aiClient
  }

  async capture(site: Site, dateStr: string): Promise<void> {
    const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--js-flags=--max-old-space-size=512',
      ],
    })
    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      await page.route('**/*', (route) => {
        const reqUrl = route.request().url()
        if (BLOCKED_DOMAINS.some((domain) => reqUrl.includes(domain))) {
          return route.abort()
        }
        return route.continue()
      })

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
        'button:has-text("OK, acceptar totes")', // https://www.ana.ad/
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
      await this.#storage.saveScreenshot(`${dateStr}/${site.slug}.png`, screenshotBuffer)

      // extract text using AI
      // --------------------------------------------------------------------------------------------------------
      console.log(`  extracting text...`)
      const structuredMarkdown = await this.#aiClient.structureAndTranslate(screenshotBuffer, site.country)
      await this.#storage.saveText(`${dateStr}/${site.slug}.md`, structuredMarkdown)
    } finally {
      await browser.close()
    }
  }
}
