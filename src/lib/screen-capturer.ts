import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { chromium } from 'playwright'
import type { Site } from './site-repository/site-repository.ts'

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
  async capture(site: Site): Promise<Buffer> {
    const startTime = performance.now()
    const tmpDir = path.join(os.tmpdir(), `paparazzo-${site.slug}`)

    const context = await chromium.launchPersistentContext(tmpDir, {
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
      locale: 'en-GB',
      timezoneId: 'Europe/London',
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
      await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 15_000 })

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
        'button:has-text("ΑΠΟΔΟΧΗ")', // https://www.amna.gr/
        'button:has-text("Αποδοχή όλων")', // https://www.amna.gr/
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', // many
      ].join()

      let acceptButtons = page.locator(locators)
      while ((await acceptButtons.count()) > 0 && counter < 3) {
        counter++
        await acceptButtons
          .first()
          .click({ timeout: 2000 })
          .catch(() => {})

        acceptButtons = page.locator(locators)
      }

      console.log(`  taking screenshot...`)
      return await page.screenshot({ fullPage: true })
    } finally {
      await context.close()
      await fs.rm(tmpDir, { recursive: true, force: true })

      const elapsedSecs = ((performance.now() - startTime) / 1000).toFixed(1)
      const memoryMB = (process.memoryUsage.rss() / 1024 / 1024).toFixed(0)
      console.log(`  done in ${elapsedSecs}s | memory: ${memoryMB} MB`)
    }
  }
}
