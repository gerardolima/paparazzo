import { ReportGenerator } from '#lib/report-generator.ts'
import { S3Storage } from '#lib/storage/s3-storage.ts'

interface ReporterEvent {
  dateStr: string
}

export const handler = async (event: ReporterEvent) => {
  console.log(`Reporter starting for date: ${event.dateStr}`)

  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    throw new Error('Missing S3_BUCKET environment variable')
  }

  const storage = new S3Storage(bucket)
  const generator = new ReportGenerator(storage)

  try {
    await generator.generate(event.dateStr)
    console.log(`Reporter successfully generated gallery for ${event.dateStr}`)
    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Gallery generated for ${event.dateStr}` }),
    }
  } catch (error: unknown) {
    console.error(`Reporter failed:`, error)
    throw error
  }
}
