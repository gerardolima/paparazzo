import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { SITES } from '../data/sites.ts'
import { loadEnv } from '../lib/config/config.ts'
import { FileStoreS3 } from '../lib/file-store/file-store-s3.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { ReportGenerator } from '../lib/report-generator.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
import type { Site } from '../lib/site-repository/site-repository.ts'
import { SiteRepositoryStatic } from '../lib/site-repository/site-repository-static.ts'

const ssm = new SSMClient()
const [ssmParamName, s3Bucket] = loadEnv('SSM_API_KEY_NAME', 'S3_BUCKET')

async function getApiKey(): Promise<string> {
  const { Parameter } = await ssm.send(
    new GetParameterCommand({
      Name: ssmParamName,
      WithDecryption: true,
    }),
  )

  const apiKey = Parameter?.Value
  if (!apiKey) {
    throw new Error(`SSM parameter ${ssmParamName} not found or empty`)
  }
  return apiKey
}

type LambdaContext = {
  getRemainingTimeInMillis(): number
}

const TIMEOUT_THRESHOLD_MS = 60_000
const MAX_RETRIES = 2

export const handler = async (_event: unknown, context: LambdaContext) => {
  const apiKey = await getApiKey()

  const dateStr = new Date().toISOString().split('T')[0]
  const siteRepo = new SiteRepositoryStatic(SITES)
  const fileStore = new FileStoreS3(s3Bucket)
  const aiClient = new AIClientGoogle(apiKey)
  const capturer = new ScreenCapturer()
  const generator = new ReportGenerator(fileStore)

  const enabledSites = await siteRepo.findEnabled()
  const processed: string[] = []
  const failed: Array<{ site: string; error: string }> = []
  let skipped = 0
  let timedOut = false
  const total = enabledSites.length

  // Phase 1: Capture screenshots
  for (let i = 0; i < total; i++) {
    if (context.getRemainingTimeInMillis() < TIMEOUT_THRESHOLD_MS) {
      console.warn(`Timeout approaching — stopping capture after ${i} of ${total} sites`)
      timedOut = true
      break
    }

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
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to capture ${site.name} (${site.version}):`, error)
      failed.push({ site: `${site.name} (${site.version})`, error: message })
    }
  }

  // Phase 2: Extract text with queue-based retry
  type QueueItem = { site: Site; attempts: number }
  const queue: QueueItem[] = []

  for (const site of enabledSites) {
    const pngPath = `${dateStr}/${site.slug}.png`
    const mdPath = `${dateStr}/${site.slug}.md`
    const pngExists = await fileStore.exists(pngPath)
    const mdExists = await fileStore.exists(mdPath)
    if (pngExists && mdExists) {
      skipped++
    } else if (pngExists) {
      queue.push({ site, attempts: 0 })
    }
  }

  while (queue.length > 0) {
    if (context.getRemainingTimeInMillis() < TIMEOUT_THRESHOLD_MS) {
      console.warn(`Timeout approaching — stopping extraction with ${queue.length} items remaining`)
      timedOut = true
      break
    }

    // biome-ignore lint/style/noNonNullAssertion: the queue is not empty
    const item = queue.shift()!
    try {
      console.log(`Extracting text for ${item.site.name} (${item.site.version})...`)
      const png = await fileStore.readFile(`${dateStr}/${item.site.slug}.png`)
      const md = await aiClient.getText(png, item.site.country)
      await fileStore.writeFile(`${dateStr}/${item.site.slug}.md`, md)
      processed.push(`${item.site.name} (${item.site.version})`)
    } catch (error) {
      if (item.attempts < MAX_RETRIES) {
        console.warn(
          `Extraction failed for ${item.site.name} (attempt ${item.attempts + 1}/${MAX_RETRIES + 1}), re-queueing`,
        )
        queue.push({ ...item, attempts: item.attempts + 1 })
      } else {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
          `Failed to extract ${item.site.name} (${item.site.version}) after ${item.attempts + 1} attempts:`,
          error,
        )
        failed.push({ site: `${item.site.name} (${item.site.version})`, error: message })
      }
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr, enabledSites)
  await generator.generateIndex()

  const summary = { dateStr, processed, failed, skipped, total, timedOut }
  console.log('Summary:', JSON.stringify(summary))

  return {
    statusCode: 200,
    body: JSON.stringify(summary),
  }
}
