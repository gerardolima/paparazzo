import { AIStructurer } from '#lib/ai-structurer.ts'
import { ScreenCapturer } from '#lib/screen-capturer.ts'
import { S3Storage } from '#lib/storage/s3-storage.ts'

interface Site {
  name: string
  url: string
}

interface WorkerEvent {
  site: Site
  dateStr: string
}

export const handler = async (event: WorkerEvent) => {
  console.log(`Worker starting for site: ${event.site.name} on date: ${event.dateStr}`)

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const bucket = process.env.S3_BUCKET

  if (!apiKey || !bucket) {
    throw new Error('Missing required environment variables (GOOGLE_GENERATIVE_AI_API_KEY, S3_BUCKET)')
  }

  const storage = new S3Storage(bucket)
  const ai = new AIStructurer(apiKey)
  const capturer = new ScreenCapturer(storage, ai)

  try {
    await capturer.capture(event.site.url, event.site.name, event.dateStr)
    console.log(`Worker successfully completed for ${event.site.name}`)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Successfully captured ${event.site.name}` }),
    }
  } catch (error: unknown) {
    console.error(`Worker failed for ${event.site.name}:`, error)
    throw error
  }
}
