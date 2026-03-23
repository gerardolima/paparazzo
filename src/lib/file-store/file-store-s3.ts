import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import type { FileStore } from './file-store.ts'

export class FileStoreS3 implements FileStore {
  readonly #client: S3Client
  readonly #bucket: string
  readonly #prefix: string

  constructor(bucket: string, prefix: string = 'media/') {
    this.#client = new S3Client()
    this.#bucket = bucket
    this.#prefix = prefix
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    const key = `${this.#prefix}${path}`
    const contentType: string = this.#contentType(path)

    await this.#client.send(
      new PutObjectCommand({
        Bucket: this.#bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    )
  }

  async readFile(path: string): Promise<string> {
    const key = `${this.#prefix}${path}`
    const response = await this.#client.send(
      new GetObjectCommand({
        Bucket: this.#bucket,
        Key: key,
      }),
    )
    return response.Body?.transformToString('utf-8') ?? ''
  }

  async readdir(path: string): Promise<string[]> {
    const prefix = `${this.#prefix}${path}/`
    const command = new ListObjectsV2Command({
      Bucket: this.#bucket,
      Prefix: prefix,
    })

    const response = await this.#client.send(command)

    if (!response.Contents) {
      return []
    }

    return response.Contents.map((item) => item.Key?.substring(prefix.length)).filter((name): name is string => !!name)
  }

  #contentType(path: string) {
    const ext = path.slice(path.lastIndexOf('.'))
    switch (ext) {
      case '.png':
        return 'image/png'
      case '.html':
        return 'text/html'
      case '.md':
        return 'text/markdown'
      default:
        return 'application/octet-stream'
    }
  }
}
