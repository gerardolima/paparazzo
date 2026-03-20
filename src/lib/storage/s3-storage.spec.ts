import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { S3Storage } from './s3-storage.ts'

const s3Mock = mockClient(S3Client)

describe('S3Storage', () => {
  const bucket = 'test-bucket'
  const region = 'us-east-1'
  let storage: S3Storage

  beforeEach(() => {
    s3Mock.reset()
    storage = new S3Storage(bucket, region)
  })

  it('saves a screenshot to S3', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    const data = Buffer.from('fake-image')
    await storage.saveScreenshot('2024-01-01/site.png', data)

    const calls = s3Mock.commandCalls(PutObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.Bucket, bucket)
    assert.strictEqual(calls[0].args[0].input.Key, 'media/2024-01-01/site.png')
    assert.strictEqual(calls[0].args[0].input.ContentType, 'image/png')
  })

  it('saves text to S3', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await storage.saveText('2024-01-01/site.md', 'some content')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.ContentType, 'text/markdown')
  })

  it('lists entries for a specific date', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: 'media/2024-01-01/site1.png' },
        { Key: 'media/2024-01-01/site1.md' },
        { Key: 'media/2024-01-01/site2.png' },
      ],
    })

    const entries = await storage.listEntries('2024-01-01')

    assert.deepStrictEqual(entries, ['site1.png', 'site1.md', 'site2.png'])
    const calls = s3Mock.commandCalls(ListObjectsV2Command)
    assert.strictEqual(calls[0].args[0].input.Prefix, 'media/2024-01-01/')
  })
})
