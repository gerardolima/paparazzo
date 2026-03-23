import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { mockClient } from 'aws-sdk-client-mock'
import { FileStoreS3 } from './file-store-s3.ts'

const s3Mock = mockClient(S3Client)

describe('FileStoreS3', () => {
  const bucket = 'test-bucket'
  let store: FileStoreS3

  beforeEach(() => {
    s3Mock.reset()
    store = new FileStoreS3(bucket)
  })

  it('saves a screenshot to S3', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    const data = Buffer.from('fake-image')
    await store.writeFile('2024-01-01/site.png', data)

    const calls = s3Mock.commandCalls(PutObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.Bucket, bucket)
    assert.strictEqual(calls[0].args[0].input.Key, 'media/2024-01-01/site.png')
    assert.strictEqual(calls[0].args[0].input.ContentType, 'image/png')
  })

  it('saves text to S3', async () => {
    s3Mock.on(PutObjectCommand).resolves({})

    await store.writeFile('2024-01-01/site.md', 'some content')

    const calls = s3Mock.commandCalls(PutObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.ContentType, 'text/markdown')
  })

  it('reads text content from S3', async () => {
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToString: async () => '<h2>Headlines</h2>' } as never,
    })

    const result = await store.readFile('2024-01-01/site.md')

    assert.equal(result, '<h2>Headlines</h2>')
    const calls = s3Mock.commandCalls(GetObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.Bucket, bucket)
    assert.strictEqual(calls[0].args[0].input.Key, 'media/2024-01-01/site.md')
  })

  it('lists entries for a specific date', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      Contents: [
        { Key: 'media/2024-01-01/site1.png' },
        { Key: 'media/2024-01-01/site1.md' },
        { Key: 'media/2024-01-01/site2.png' },
      ],
    })

    const entries = await store.readdir('2024-01-01')

    assert.deepStrictEqual(entries, ['site1.png', 'site1.md', 'site2.png'])
    const calls = s3Mock.commandCalls(ListObjectsV2Command)
    assert.strictEqual(calls[0].args[0].input.Prefix, 'media/2024-01-01/')
  })
})
