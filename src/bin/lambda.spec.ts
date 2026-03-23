import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

const mockCapture = mock.fn(async () => {})
const mockGenerate = mock.fn(async () => {})
const mockSsmSend = mock.fn(async () => ({ Parameter: { Value: 'test-api-key' } }))

mock.module('../lib/config/config.ts', {
  namedExports: {
    loadEnv: () => ['/paparazzo/google-api-key', 'test-bucket'],
  },
})
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
mock.module('../lib/file-store/file-store-s3.ts', {
  namedExports: { FileStoreS3: class {} },
})
mock.module('../lib/ia-client/ai-client-google.ts', {
  namedExports: { AIClientGoogle: class {} },
})
mock.module('../data/sites.ts', {
  namedExports: {
    SITES: [
      {
        slug: 'site1',
        name: 'Site1',
        description: 'Desc',
        country: 'CountryA',
        version: 'original',
        url: 'https://site1.com',
        enabled: true,
      },
      {
        slug: 'site2-eng',
        name: 'Site2',
        description: null,
        country: 'CountryB',
        version: 'english',
        url: 'https://site2.com',
        enabled: true,
      },
      {
        slug: 'site3',
        name: 'Site3',
        description: 'Disabled',
        country: 'CountryC',
        version: 'original',
        url: 'https://site3.com',
        enabled: false,
      },
    ],
  },
})
mock.module('@aws-sdk/client-ssm', {
  namedExports: {
    SSMClient: class {
      send = mockSsmSend
    },
    GetParameterCommand: class {},
  },
})

const { handler } = await import('./lambda.ts')

describe('handler', () => {
  beforeEach(() => {
    mockCapture.mock.mockImplementation(async () => {})
    mockGenerate.mock.mockImplementation(async () => {})
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: 'test-api-key' } }))
  })

  afterEach(() => {
    mockCapture.mock.resetCalls()
    mockGenerate.mock.resetCalls()
    mockSsmSend.mock.resetCalls()
  })

  it('throws when SSM parameter returns empty value', async () => {
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: undefined as unknown as string } }))

    await assert.rejects(() => handler(), {
      message: /SSM parameter/,
    })
  })

  it('processes only enabled sites and generates report on success', async () => {
    const result = await handler()

    assert.equal(mockCapture.mock.callCount(), 2)
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

    assert.equal(mockCapture.mock.callCount(), 2)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(result.statusCode, 200)
  })

  it('returns 200 with summary of enabled sites only', async () => {
    const result = await handler()
    const body = JSON.parse(result.body)

    assert.equal(result.statusCode, 200)
    assert.ok(body.processed)
    assert.equal(body.processed.length, 2)
    assert.equal(body.total, 2)
  })
})
