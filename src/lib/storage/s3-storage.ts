import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { Storage } from './storage.ts'

export class S3Storage implements Storage {
  private client: S3Client
  private bucket: string
  private prefix: string

  constructor(bucket: string, prefix: string = 'media/') {
    this.client = new S3Client()
    this.bucket = bucket
    this.prefix = prefix
  }

  async saveScreenshot(filename: string, data: Buffer): Promise<void> {
    const key = `${this.prefix}${filename}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: 'image/png',
      }),
    )
  }

  async saveText(filename: string, content: string): Promise<void> {
    const key = `${this.prefix}${filename}`
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: filename.endsWith('.html') ? 'text/html' : 'text/markdown',
      }),
    )
  }

  async listEntries(dateStr: string): Promise<string[]> {
    const prefix = `${this.prefix}${dateStr}/`
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
    })

    const response = await this.client.send(command)

    if (!response.Contents) {
      return []
    }

    // Return only the basenames (relative to the date folder)
    return response.Contents.map((item) => item.Key?.substring(prefix.length)).filter((name): name is string => !!name)
  }
}
