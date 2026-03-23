import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { chromium } from 'playwright'
import type { Site } from './data/sites.ts'
import type { FileStore } from './file-store/file-store.ts'
import type { AIClient } from './ia-client/ai-client.ts'

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
  public static readonly tmpDir: string = path.join(os.tmpdir(), 'paparazzo-browser')

  readonly #fileStore: FileStore
  readonly #aiClient: AIClient

  constructor(fileStore: FileStore, aiClient: AIClient) {
    this.#fileStore = fileStore
    this.#aiClient = aiClient
  }

  async capture(site: Site, dateStr: string): Promise<void> {
    const startTime = performance.now()

    const context = await chromium.launchPersistentContext(ScreenCapturer.tmpDir, {
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
        '--disk-cache-size=52428800', // 50 MB
      ],
    })

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
      await this.#fileStore.writeFile(`${dateStr}/${site.slug}.png`, screenshotBuffer)

      // extract text using AI
      // --------------------------------------------------------------------------------------------------------
      console.log(`  extracting text...`)
      const structuredMarkdown = await this.#aiClient.structureAndTranslate(screenshotBuffer, site.country)
      await this.#fileStore.writeFile(`${dateStr}/${site.slug}.md`, structuredMarkdown)
    } finally {
      await context.close()
      await fs.rm(ScreenCapturer.tmpDir, { recursive: true, force: true })

      const elapsedSecs = ((performance.now() - startTime) / 1000).toFixed(1)
      const memoryMB = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0)
      console.log(`  done in ${elapsedSecs}s | memory: ${memoryMB} MB`)
    }
  }
}
