import { SITES } from '../data/sites.ts'
import { FileStoreLocal } from '../lib/file-store/file-store-local.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { ReportGenerator } from '../lib/report-generator.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
import { SiteRepositoryStatic } from '../lib/site-repository/site-repository-static.ts'

async function run() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.')
    process.exit(1)
  }

  const dateStr = new Date().toISOString().split('T')[0]
  const siteRepo = new SiteRepositoryStatic(SITES)
  const fileStore = new FileStoreLocal()
  const aiClient = new AIClientGoogle(apiKey)
  const capturer = new ScreenCapturer(fileStore, aiClient)
  const generator = new ReportGenerator(fileStore)

  console.log(`Starting Paparazzo for ${dateStr}...`)

  const enabledSites = await siteRepo.findEnabled()
  const total = enabledSites.length
  for (let i = 0; i < total; i++) {
    const site = enabledSites[i]
    try {
      console.log(`${i + 1} / ${total} Processing ${site.name} (${site.version})...`)
      await capturer.capture(site, dateStr)
    } catch (error) {
      console.error(`Failed to process ${site.name} (${site.version}):`, error)
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr, enabledSites)

  console.log(`Done! Report available in out/media/${dateStr}/index.html`)
}

run().catch(console.error)
