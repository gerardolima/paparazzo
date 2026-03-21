import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

const mockCapture = mock.fn(async () => { })
const mockGenerate = mock.fn(async () => { })
const mockSsmSend = mock.fn(async () => ({ Parameter: { Value: 'test-api-key' } }))

mock.module('../lib/screen-capturer.ts', {
  namedExports: {
    ScreenCapturer: class {
      capture = mockCapture
    },
  },
})
mock.module('../lib/report-generator.ts', {
  namedExports: {
    ReportGenerator: class {
      generate = mockGenerate
    },
  },
})
mock.module('../lib/storage/s3-storage.ts', {
  namedExports: { S3Storage: class { } },
})
mock.module('../lib/ai-structurer.ts', {
  namedExports: { AIStructurer: class { } },
})
mock.module('@aws-sdk/client-ssm', {
  namedExports: {
    SSMClient: class {
      send = mockSsmSend
    },
    GetParameterCommand: class { },
  },
})

const { handler } = await import('./lambda.ts')

describe('handler', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.SSM_API_KEY_NAME = '/paparazzo/google-api-key'
    process.env.S3_BUCKET = 'test-bucket'
    mockCapture.mock.mockImplementation(async () => { })
    mockGenerate.mock.mockImplementation(async () => { })
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: 'test-api-key' } }))
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    mockCapture.mock.resetCalls()
    mockGenerate.mock.resetCalls()
    mockSsmSend.mock.resetCalls()
  })

  it('throws when SSM_API_KEY_NAME is missing', async () => {
    delete process.env.SSM_API_KEY_NAME

    await assert.rejects(() => handler(), {
      message: /SSM_API_KEY_NAME/,
    })
  })

  it('throws when SSM parameter returns empty value', async () => {
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: undefined as unknown as string } }))

    await assert.rejects(() => handler(), {
      message: /SSM parameter/,
    })
  })

  it('throws when S3_BUCKET is missing', async () => {
    delete process.env.S3_BUCKET

    await assert.rejects(() => handler(), {
      message: /S3_BUCKET/,
    })
  })

  it('processes all sites and generates report on success', async () => {
    const result = await handler()

    assert.equal(mockCapture.mock.callCount(), 3)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(result.statusCode, 200)
  })

  it('continues processing remaining sites when one fails', async () => {
    let callCount = 0
    mockCapture.mock.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('site failure')
    })

    const result = await handler()

    assert.equal(mockCapture.mock.callCount(), 3)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(result.statusCode, 200)
  })

  it('returns 200 with summary including site names', async () => {
    const result = await handler()
    const body = JSON.parse(result.body)

    assert.equal(result.statusCode, 200)
    assert.ok(body.processed)
    assert.equal(body.processed.length, 3)
  })
})
