import assert from 'node:assert/strict'
import { beforeEach, describe, it } from 'node:test'
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
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

  it('reads file content as Buffer from S3', async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    s3Mock.on(GetObjectCommand).resolves({
      Body: { transformToByteArray: async () => bytes } as never,
    })

    const result = await store.readFile('2024-01-01/site.md')

    assert.ok(Buffer.isBuffer(result))
    assert.deepEqual(result, Buffer.from(bytes))
    const calls = s3Mock.commandCalls(GetObjectCommand)
    assert.strictEqual(calls.length, 1)
    assert.strictEqual(calls[0].args[0].input.Bucket, bucket)
    assert.strictEqual(calls[0].args[0].input.Key, 'media/2024-01-01/site.md')
  })

  it('returns true when file exists in S3', async () => {
    s3Mock.on(HeadObjectCommand).resolves({})

    assert.equal(await store.exists('2024-01-01/site.png'), true)
    const calls = s3Mock.commandCalls(HeadObjectCommand)
    assert.strictEqual(calls[0].args[0].input.Bucket, bucket)
    assert.strictEqual(calls[0].args[0].input.Key, 'media/2024-01-01/site.png')
  })

  it('returns false when file does not exist in S3', async () => {
    s3Mock.on(HeadObjectCommand).rejects({ name: 'NotFound' })

    assert.equal(await store.exists('2024-01-01/missing.png'), false)
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

  it('lists subdirectories using CommonPrefixes', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({
      CommonPrefixes: [
        { Prefix: 'media/2024-01-01/' },
        { Prefix: 'media/2024-06-15/' },
        { Prefix: 'media/2025-03-27/' },
      ],
    })

    const dirs = await store.readdir('', 'directory')

    assert.deepStrictEqual(dirs, ['2024-01-01', '2024-06-15', '2025-03-27'])
    const calls = s3Mock.commandCalls(ListObjectsV2Command)
    assert.strictEqual(calls[0].args[0].input.Prefix, 'media/')
    assert.strictEqual(calls[0].args[0].input.Delimiter, '/')
  })

  it('returns empty array when no subdirectories exist', async () => {
    s3Mock.on(ListObjectsV2Command).resolves({})

    const dirs = await store.readdir('', 'directory')

    assert.deepStrictEqual(dirs, [])
  })
})
