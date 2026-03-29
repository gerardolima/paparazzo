import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'

const mockCapture = mock.fn(async () => Buffer.from('fake-screenshot'))
const mockGenerate = mock.fn(async () => {})
const mockGenerateIndex = mock.fn(async () => {})
const mockWriteFile = mock.fn(async (_path: string, _data: Buffer | string) => {})
const mockReadFile = mock.fn(async (_path: string) => Buffer.from('stored-png'))
const mockExists = mock.fn(async (_path: string) => false)
const mockGetText = mock.fn(async (_buffer: Buffer, _country: string) => '<h2>Content</h2>')
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
      readFile = mockReadFile
      readdir = mock.fn(async () => [])
      exists = mockExists
    },
  },
})
mock.module('../lib/ia-client/ai-client-google.ts', {
  namedExports: {
    AIClientGoogle: class {
      getText = mockGetText
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

// Tracks paths written by writeFile so exists() can reflect phase 1 writes in phase 2
let written: Set<string>

describe('handler', () => {
  beforeEach(() => {
    written = new Set()
    mockWriteFile.mock.mockImplementation(async (path: string) => {
      written.add(path)
    })
    mockExists.mock.mockImplementation(async (path: string) => written.has(path))
    mockReadFile.mock.mockImplementation(async () => Buffer.from('stored-png'))
    mockCapture.mock.mockImplementation(async () => Buffer.from('fake-screenshot'))
    mockGenerate.mock.mockImplementation(async () => {})
    mockGenerateIndex.mock.mockImplementation(async () => {})
    mockGetText.mock.mockImplementation(async () => '<h2>Content</h2>')
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: 'test-api-key' } }))
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => 300_000)
  })

  afterEach(() => {
    mockCapture.mock.resetCalls()
    mockGenerate.mock.resetCalls()
    mockGenerateIndex.mock.resetCalls()
    mockWriteFile.mock.resetCalls()
    mockReadFile.mock.resetCalls()
    mockExists.mock.resetCalls()
    mockGetText.mock.resetCalls()
    mockSsmSend.mock.resetCalls()
    mockLambdaContext.getRemainingTimeInMillis.mock.resetCalls()
  })

  it('throws when SSM parameter returns empty value', async () => {
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: undefined as unknown as string } }))

    await assert.rejects(() => handler(undefined, mockLambdaContext), {
      message: /SSM parameter/,
    })
  })

  describe('fresh run (no pre-existing files)', () => {
    it('captures and extracts all enabled sites', async () => {
      const result = await handler(undefined, mockLambdaContext)

      assert.equal(mockCapture.mock.callCount(), 2)
      assert.equal(mockGetText.mock.callCount(), 2)
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

    it('reads stored PNG and passes it to AI client for extraction', async () => {
      mockReadFile.mock.mockImplementation(async () => Buffer.from('read-back-png'))

      await handler(undefined, mockLambdaContext)

      assert.equal(mockGetText.mock.callCount(), 2)
      const firstCall = mockGetText.mock.calls[0]
      assert.equal(firstCall.arguments[0].toString(), 'read-back-png')
      assert.equal(firstCall.arguments[1], 'CountryA')
      assert.equal(mockGetText.mock.calls[1].arguments[1], 'CountryB')
    })

    it('saves AI-extracted markdown to file store', async () => {
      await handler(undefined, mockLambdaContext)

      const mdWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.md'))
      assert.equal(mdWrites.length, 2)
      assert.ok(String(mdWrites[0].arguments[0]).includes('site1.md'))
      assert.equal(mdWrites[0].arguments[1], '<h2>Content</h2>')
    })

    it('returns 200 with summary of processed sites', async () => {
      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      assert.equal(result.statusCode, 200)
      assert.equal(body.processed.length, 2)
      assert.equal(body.total, 2)
    })
  })

  describe('idempotent execution (skip existing files)', () => {
    it('skips capture when PNG already exists', async () => {
      mockExists.mock.mockImplementation(async (path: string) => {
        if (path.endsWith('.png')) return true
        return written.has(path)
      })

      await handler(undefined, mockLambdaContext)

      assert.equal(mockCapture.mock.callCount(), 0)
      assert.equal(mockGetText.mock.callCount(), 2)
    })

    it('reads stored PNG for extraction when PNG exists but MD does not', async () => {
      mockExists.mock.mockImplementation(async (path: string) => path.endsWith('.png'))
      mockReadFile.mock.mockImplementation(async () => Buffer.from('existing-png'))

      await handler(undefined, mockLambdaContext)

      assert.equal(mockCapture.mock.callCount(), 0)
      const firstCall = mockGetText.mock.calls[0]
      assert.equal(firstCall.arguments[0].toString(), 'existing-png')
    })

    it('skips entirely when both PNG and MD exist', async () => {
      mockExists.mock.mockImplementation(async () => true)

      await handler(undefined, mockLambdaContext)

      assert.equal(mockCapture.mock.callCount(), 0)
      assert.equal(mockGetText.mock.callCount(), 0)
      assert.equal(mockGenerate.mock.callCount(), 1)
    })

    it('reports skipped count for fully processed sites', async () => {
      mockExists.mock.mockImplementation(async () => true)

      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      assert.equal(body.skipped, 2)
    })
  })

  describe('queue-based retry for extraction', () => {
    it('re-queues failed site and retries after processing other sites', async () => {
      let callCount = 0
      mockGetText.mock.mockImplementation(async (_buffer: Buffer, country: string) => {
        callCount++
        if (country === 'CountryA' && callCount <= 2) throw new Error('503 Service Unavailable')
        return '<h2>Content</h2>'
      })

      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      // site1 fails(1), site2 succeeds(2), site1 retried and succeeds(3)
      assert.equal(mockGetText.mock.callCount(), 3)
      assert.equal(body.processed.length, 2)
    })

    it('gives up on site after max retries', async () => {
      mockGetText.mock.mockImplementation(async (_buffer: Buffer, country: string) => {
        if (country === 'CountryA') throw new Error('503 Service Unavailable')
        return '<h2>Content</h2>'
      })

      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      // site1: fail(0), re-queue, fail(1), re-queue, fail(2) → dropped
      // site2: success
      assert.equal(mockGetText.mock.callCount(), 4)
      assert.equal(body.processed.length, 1)
    })

    it('reports failed sites with error message in response', async () => {
      mockGetText.mock.mockImplementation(async (_buffer: Buffer, country: string) => {
        if (country === 'CountryA') throw new Error('503 Service Unavailable')
        return '<h2>Content</h2>'
      })

      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      assert.equal(body.failed.length, 1)
      assert.equal(body.failed[0].site, 'Site1 (original)')
      assert.equal(body.failed[0].error, '503 Service Unavailable')
    })
  })

  describe('error handling', () => {
    it('continues capturing remaining sites when one capture fails', async () => {
      let callCount = 0
      mockCapture.mock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('site failure')
        return Buffer.from('fake-screenshot')
      })

      await handler(undefined, mockLambdaContext)

      assert.equal(mockCapture.mock.callCount(), 2)
      // Only site2 has PNG → only site2 extracted
      assert.equal(mockGetText.mock.callCount(), 1)
    })

    it('reports capture failures in response', async () => {
      let callCount = 0
      mockCapture.mock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('net::ERR_CONNECTION_TIMED_OUT')
        return Buffer.from('fake-screenshot')
      })

      const result = await handler(undefined, mockLambdaContext)
      const body = JSON.parse(result.body)

      assert.equal(body.failed.length, 1)
      assert.equal(body.failed[0].site, 'Site1 (original)')
      assert.equal(body.failed[0].error, 'net::ERR_CONNECTION_TIMED_OUT')
    })

    it('saves screenshot even when AI extraction fails for all sites', async () => {
      mockGetText.mock.mockImplementation(async () => {
        throw new Error('AI service unavailable')
      })

      await handler(undefined, mockLambdaContext)

      const pngWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.png'))
      assert.equal(pngWrites.length, 2)
    })
  })

  describe('timeout handling', () => {
    it('updates root index after generating daily report', async () => {
      await handler(undefined, mockLambdaContext)

      assert.equal(mockGenerateIndex.mock.callCount(), 1)
    })

    it('stops capture when remaining time falls below threshold', async () => {
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
})
