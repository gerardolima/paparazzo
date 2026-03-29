import { SITES } from '../data/sites.ts'
import { loadEnv } from '../lib/config/config.ts'
import { FileStoreLocal } from '../lib/file-store/file-store-local.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { ReportGenerator } from '../lib/report-generator.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
import type { Site } from '../lib/site-repository/site-repository.ts'
import { SiteRepositoryStatic } from '../lib/site-repository/site-repository-static.ts'

const MAX_RETRIES = 2

async function run() {
  const [apiKeyGoogleAI] = loadEnv('GOOGLE_GENERATIVE_AI_API_KEY')

  const dateStr = new Date().toISOString().split('T')[0]
  const siteRepo = new SiteRepositoryStatic(SITES)
  const fileStore = new FileStoreLocal()
  const aiClient = new AIClientGoogle(apiKeyGoogleAI)
  const capturer = new ScreenCapturer()
  const generator = new ReportGenerator(fileStore)

  console.log(`Starting Paparazzo for ${dateStr}...`)

  const enabledSites = await siteRepo.findEnabled()
  const total = enabledSites.length

  // Phase 1: Capture screenshots
  for (let i = 0; i < total; i++) {
    const site = enabledSites[i]
    const pngPath = `${dateStr}/${site.slug}.png`

    if (await fileStore.exists(pngPath)) {
      console.log(`${i + 1} / ${total} ${site.name} (${site.version}): screenshot exists, skipping`)
      continue
    }

    try {
      console.log(`${i + 1} / ${total} Capturing ${site.name} (${site.version})...`)
      const buffer = await capturer.capture(site)
      await fileStore.writeFile(pngPath, buffer)
    } catch (error) {
      console.error(`Failed to capture ${site.name} (${site.version}):`, error)
    }
  }

  // Phase 2: Extract text with queue-based retry
  type QueueItem = { site: Site; attempts: number }
  const queue: QueueItem[] = []

  for (const site of enabledSites) {
    const pngPath = `${dateStr}/${site.slug}.png`
    const mdPath = `${dateStr}/${site.slug}.md`
    if ((await fileStore.exists(pngPath)) && !(await fileStore.exists(mdPath))) {
      queue.push({ site, attempts: 0 })
    }
  }

  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: the queue is not empty
    const item = queue.shift()!
    try {
      console.log(`Extracting text for ${item.site.name} (${item.site.version})...`)
      const png = await fileStore.readFile(`${dateStr}/${item.site.slug}.png`)
      const md = await aiClient.getText(png, item.site.country)
      await fileStore.writeFile(`${dateStr}/${item.site.slug}.md`, md)
    } catch (error) {
      if (item.attempts < MAX_RETRIES) {
        console.warn(
          `Extraction failed for ${item.site.name} (attempt ${item.attempts + 1}/${MAX_RETRIES + 1}), re-queueing`,
        )
        queue.push({ ...item, attempts: item.attempts + 1 })
      } else {
        console.error(
          `Failed to extract ${item.site.name} (${item.site.version}) after ${item.attempts + 1} attempts:`,
          error,
        )
      }
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr, enabledSites)
  await generator.generateIndex()

  console.log(`Done! Report available in out/media/${dateStr}/index.html`)
}

try {
  await run()
} catch (error) {
  console.error(error)
  process.exit(1)
}
