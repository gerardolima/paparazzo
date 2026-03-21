import { AIStructurer } from '../lib/ai-structurer.ts'
import { SITES } from '../lib/config/sites.ts'
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
  const ai = new AIStructurer(apiKey)
  const capturer = new ScreenCapturer(storage, ai)
  const generator = new ReportGenerator(storage)

  console.log(`Starting Paparazzo for ${dateStr}...`)

  for (const site of SITES) {
    try {
      console.log(`Processing ${site.name}...`)
      await capturer.capture(site.url, site.name, dateStr)
    } catch (error) {
      console.error(`Failed to process ${site.name}:`, error)
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr)

  console.log(`Done! Report available in out/media/${dateStr}/index.html`)
}

run().catch(console.error)
