import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { SITES } from '../data/sites.ts'
import { loadEnv } from '../lib/config/config.ts'
import { FileStoreS3 } from '../lib/file-store/file-store-s3.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { ReportGenerator } from '../lib/report-generator.ts'
import { ScreenCapturer } from '../lib/screen-capturer.ts'
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

export const handler = async (_event: unknown, context: LambdaContext) => {
  const apiKey = await getApiKey()

  const dateStr = new Date().toISOString().split('T')[0]
  const siteRepo = new SiteRepositoryStatic(SITES)
  const fileStore = new FileStoreS3(s3Bucket)
  const aiClient = new AIClientGoogle(apiKey)
  const capturer = new ScreenCapturer(fileStore, aiClient)
  const generator = new ReportGenerator(fileStore)

  const enabledSites = await siteRepo.findEnabled()
  const processed: string[] = []

  let timedOut = false
  const total = enabledSites.length
  for (let i = 0; i < total; i++) {
    if (context.getRemainingTimeInMillis() < TIMEOUT_THRESHOLD_MS) {
      console.warn(`Timeout approaching — stopping after ${i} of ${total} sites`)
      timedOut = true
      break
    }

    const site = enabledSites[i]
    try {
      console.log(`${i + 1} / ${total} Processing ${site.name} (${site.version})...`)
      await capturer.capture(site, dateStr)
      processed.push(`${site.name} (${site.version})`)
    } catch (error) {
      console.error(`Failed to process ${site.name} (${site.version}):`, error)
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr, enabledSites)
  await generator.generateIndex()

  return {
    statusCode: 200,
    body: JSON.stringify({ dateStr, processed, total: enabledSites.length, timedOut }),
  }
}
