import { SITES } from '../data/sites.ts'
import { loadEnv } from '../lib/config/config.ts'
import { FileStoreLocal } from '../lib/file-store/file-store-local.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { start } from '../lib/main.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
import { SiteRepositoryStatic } from '../lib/site-repository/site-repository-static.ts'

async function run() {
  const [apiKey] = loadEnv('GOOGLE_GENERATIVE_AI_API_KEY')
  const sites = await new SiteRepositoryStatic(SITES).findEnabled()

  const summary = await start({
    sites,
    fileStore: new FileStoreLocal(),
    aiClient: new AIClientGoogle(apiKey),
    capturer: new ScreenCapturer(),
  })

  console.log(`Done! Report available in out/media/${summary.dateStr}/index.html`)
}

try {
  await run()
} catch (error) {
  console.error(error)
  process.exit(1)
}
