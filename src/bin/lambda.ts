import { setTimeout as delay } from 'node:timers/promises'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import type { Context } from 'aws-lambda'
import { SITES } from '../data/sites.ts'
import { loadEnv } from '../lib/config/config.ts'
import { FileStoreS3 } from '../lib/file-store/file-store-s3.ts'
import { AIClientGoogle } from '../lib/ia-client/ai-client-google.ts'
import { start } from '../lib/main.ts'
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

const TIMEOUT_THRESHOLD_MS = 60_000

export const handler = async (_event: unknown, context: Context) => {
  const apiKey = await getApiKey()
  const sites = await new SiteRepositoryStatic(SITES).findEnabled()

  const controller = new AbortController()
  const timeoutMs = context.getRemainingTimeInMillis() - TIMEOUT_THRESHOLD_MS

  // trigger the abort signal, so `start` can stop execution before Lambda hard-kills the process
  delay(Math.max(0, timeoutMs), undefined, { ref: false }).then(() => controller.abort())

  const summary = await start({
    sites,
    fileStore: new FileStoreS3(s3Bucket),
    aiClient: new AIClientGoogle(apiKey),
    capturer: new ScreenCapturer(),
    signal: controller.signal,
  })
  console.log('Summary:', JSON.stringify(summary))

  return { statusCode: 200, body: JSON.stringify(summary) }
}
