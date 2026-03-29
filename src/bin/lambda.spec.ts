import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

const mockCapture = mock.fn(async () => Buffer.from('fake-screenshot'))
const mockGenerate = mock.fn(async () => {})
const mockGenerateIndex = mock.fn(async () => {})
const mockWriteFile = mock.fn(async (_path: string, _data: Buffer | string) => {})
const mockStructureAndTranslate = mock.fn(async (_buffer: Buffer, _country: string) => '<h2>Content</h2>')
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
      generateIndex = mockGenerateIndex
    },
  },
})
mock.module('../lib/file-store/file-store-s3.ts', {
  namedExports: {
    FileStoreS3: class {
      writeFile = mockWriteFile
      readFile = mock.fn(async () => '')
      readdir = mock.fn(async () => [])
    },
  },
})
mock.module('../lib/ia-client/ai-client-google.ts', {
  namedExports: {
    AIClientGoogle: class {
      structureAndTranslate = mockStructureAndTranslate
    },
  },
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

const mockLambdaContext = {
  getRemainingTimeInMillis: mock.fn((): number => 300_000),
}

describe('handler', () => {
  beforeEach(() => {
    mockCapture.mock.mockImplementation(async () => Buffer.from('fake-screenshot'))
    mockGenerate.mock.mockImplementation(async () => {})
    mockGenerateIndex.mock.mockImplementation(async () => {})
    mockWriteFile.mock.mockImplementation(async () => {})
    mockStructureAndTranslate.mock.mockImplementation(async () => '<h2>Content</h2>')
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: 'test-api-key' } }))
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => 300_000)
  })

  afterEach(() => {
    mockCapture.mock.resetCalls()
    mockGenerate.mock.resetCalls()
    mockGenerateIndex.mock.resetCalls()
    mockWriteFile.mock.resetCalls()
    mockStructureAndTranslate.mock.resetCalls()
    mockSsmSend.mock.resetCalls()
    mockLambdaContext.getRemainingTimeInMillis.mock.resetCalls()
  })

  it('throws when SSM parameter returns empty value', async () => {
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: undefined as unknown as string } }))

    await assert.rejects(() => handler(undefined, mockLambdaContext), {
      message: /SSM parameter/,
    })
  })

  it('processes only enabled sites and generates report on success', async () => {
    const result = await handler(undefined, mockLambdaContext)

    assert.equal(mockCapture.mock.callCount(), 2)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(result.statusCode, 200)
  })

  it('saves screenshot to file store after capture', async () => {
    await handler(undefined, mockLambdaContext)

    const pngWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.png'))
    assert.equal(pngWrites.length, 2)
    assert.ok(String(pngWrites[0].arguments[0]).includes('site1.png'))
    assert.ok(Buffer.isBuffer(pngWrites[0].arguments[1]))
  })

  it('passes screenshot buffer and country to AI client', async () => {
    await handler(undefined, mockLambdaContext)

    assert.equal(mockStructureAndTranslate.mock.callCount(), 2)
    const firstCall = mockStructureAndTranslate.mock.calls[0]
    assert.ok(Buffer.isBuffer(firstCall.arguments[0]))
    assert.equal(firstCall.arguments[1], 'CountryA')
    assert.equal(mockStructureAndTranslate.mock.calls[1].arguments[1], 'CountryB')
  })

  it('saves AI-extracted markdown to file store', async () => {
    await handler(undefined, mockLambdaContext)

    const mdWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.md'))
    assert.equal(mdWrites.length, 2)
    assert.ok(String(mdWrites[0].arguments[0]).includes('site1.md'))
    assert.equal(mdWrites[0].arguments[1], '<h2>Content</h2>')
  })

  it('continues processing remaining sites when capture fails', async () => {
    let callCount = 0
    mockCapture.mock.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('site failure')
      return Buffer.from('fake-screenshot')
    })

    const result = await handler(undefined, mockLambdaContext)

    assert.equal(mockCapture.mock.callCount(), 2)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(result.statusCode, 200)
  })

  it('continues processing remaining sites when AI extraction fails', async () => {
    let callCount = 0
    mockStructureAndTranslate.mock.mockImplementation(async () => {
      callCount++
      if (callCount === 1) throw new Error('AI service unavailable')
      return '<h2>Content</h2>'
    })

    const result = await handler(undefined, mockLambdaContext)

    assert.equal(mockCapture.mock.callCount(), 2)
    assert.equal(mockStructureAndTranslate.mock.callCount(), 2)
    assert.equal(result.statusCode, 200)
  })

  it('saves screenshot even when AI extraction fails', async () => {
    mockStructureAndTranslate.mock.mockImplementation(async () => {
      throw new Error('AI service unavailable')
    })

    await handler(undefined, mockLambdaContext)

    const pngWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.png'))
    assert.equal(pngWrites.length, 2)
  })

  it('returns 200 with summary of enabled sites only', async () => {
    const result = await handler(undefined, mockLambdaContext)
    const body = JSON.parse(result.body)

    assert.equal(result.statusCode, 200)
    assert.ok(body.processed)
    assert.equal(body.processed.length, 2)
    assert.equal(body.total, 2)
  })

  it('updates root index after generating daily report', async () => {
    await handler(undefined, mockLambdaContext)

    assert.equal(mockGenerateIndex.mock.callCount(), 1)
  })

  it('stops processing when remaining time falls below threshold', async () => {
    let callCount = 0
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => {
      callCount++
      return callCount <= 1 ? 300_000 : 30_000
    })

    const result = await handler(undefined, mockLambdaContext)
    const body = JSON.parse(result.body)

    assert.equal(mockCapture.mock.callCount(), 1)
    assert.equal(body.timedOut, true)
    assert.equal(mockGenerate.mock.callCount(), 1)
  })

  it('generates report even when timed out before processing any site', async () => {
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => 10_000)

    const result = await handler(undefined, mockLambdaContext)
    const body = JSON.parse(result.body)

    assert.equal(mockCapture.mock.callCount(), 0)
    assert.equal(mockGenerate.mock.callCount(), 1)
    assert.equal(body.timedOut, true)
  })
})
