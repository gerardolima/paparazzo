import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { ProcessResult } from '../lib/main.ts'

const mockStart = mock.fn(async (): Promise<ProcessResult> => ({
  dateStr: '2026-03-30',
  processed: ['Site1 (original)'],
  failed: [],
  skipped: 0,
  total: 1,
  timedOut: false,
}))
const mockSsmSend = mock.fn(async () => ({ Parameter: { Value: 'test-api-key' } }))

mock.module('../lib/config/config.ts', {
  namedExports: {
    loadEnv: () => ['/paparazzo/google-api-key', 'test-bucket'],
  },
})
mock.module('../lib/main.ts', {
  namedExports: { start: mockStart },
})
mock.module('../lib/file-store/file-store-s3.ts', {
  namedExports: { FileStoreS3: class {} },
})
mock.module('../lib/ia-client/ai-client-google.ts', {
  namedExports: { AIClientGoogle: class {} },
})
mock.module('../lib/screen-capturer.ts', {
  namedExports: { ScreenCapturer: class {} },
})
mock.module('../data/sites.ts', {
  namedExports: {
    SITES: [{ slug: 's1', name: 'S1', description: '', country: 'C', version: 'original', url: 'https://s1.com', enabled: true }],
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
    mockStart.mock.mockImplementation(async () => ({
      dateStr: '2026-03-30',
      processed: ['S1 (original)'],
      failed: [],
      skipped: 0,
      total: 1,
      timedOut: false,
    }))
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: 'test-api-key' } }))
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => 300_000)
  })

  afterEach(() => {
    mockStart.mock.resetCalls()
    mockSsmSend.mock.resetCalls()
    mockLambdaContext.getRemainingTimeInMillis.mock.resetCalls()
  })

  it('throws when SSM parameter returns empty value', async () => {
    mockSsmSend.mock.mockImplementation(async () => ({ Parameter: { Value: undefined as unknown as string } }))

    await assert.rejects(() => handler(undefined, mockLambdaContext), {
      message: /SSM parameter/,
    })
  })

  it('calls start with an AbortSignal', async () => {
    await handler(undefined, mockLambdaContext)

    assert.equal(mockStart.mock.callCount(), 1)
    const options = mockStart.mock.calls[0].arguments[0]
    assert.ok(options.signal instanceof AbortSignal)
    assert.ok(Array.isArray(options.sites))
    assert.ok(options.fileStore)
    assert.ok(options.aiClient)
    assert.ok(options.capturer)
  })

  it('returns 200 with summary from start', async () => {
    const result = await handler(undefined, mockLambdaContext)

    assert.equal(result.statusCode, 200)
    const body = JSON.parse(result.body)
    assert.equal(body.processed.length, 1)
    assert.equal(body.total, 1)
  })

  it('aborts signal when timeout expires via Promise.race', async () => {
    mockLambdaContext.getRemainingTimeInMillis.mock.mockImplementation(() => 60_000)

    // start blocks long enough for the 0ms delay to fire
    mockStart.mock.mockImplementation(async (options) => {
      // Wait a tick so the delay(0).then(abort) can fire
      await new Promise((resolve) => setTimeout(resolve, 10))
      return {
        dateStr: '2026-03-30',
        processed: [],
        failed: [],
        skipped: 0,
        total: 1,
        timedOut: options.signal?.aborted ?? false,
      }
    })

    const result = await handler(undefined, mockLambdaContext)
    const body = JSON.parse(result.body)

    assert.equal(body.timedOut, true)
  })
})
