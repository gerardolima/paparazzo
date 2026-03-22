import { SITES } from '../lib/data/sites.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { ReportGenerator } from '../lib/report-generator.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
import { LocalStorage } from '../lib/storage/local-storage.ts'

async function run() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    console.error('Missing GOOGLE_GENERATIVE_AI_API_KEY environment variable.')
    process.exit(1)
  }

  const dateStr = new Date().toISOString().split('T')[0]
  const storage = new LocalStorage()
  const aiClient = new AIClientGoogle(apiKey)
  const capturer = new ScreenCapturer(storage, aiClient)
  const generator = new ReportGenerator(storage)

  console.log(`Starting Paparazzo for ${dateStr}...`)

  const enabledSites = SITES.filter((s) => s.enabled)

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
