import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { FileStore } from './file-store/file-store.ts'
import type { AIClient } from './ia-client/ai-client.ts'
import type { Site } from './site-repository/site-repository.ts'

// ReportGenerator is the only concrete class start() creates internally.
// Mock the module so it doesn't try to use a real FileStore.
const mockGenerate = mock.fn(async () => {})
const mockGenerateIndex = mock.fn(async () => {})

mock.module('./report-generator.ts', {
  namedExports: {
    ReportGenerator: class {
      generate = mockGenerate
      generateIndex = mockGenerateIndex
    },
  },
})

const { start } = await import('./main.ts')

const enabledSites: Site[] = [
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
]

// Direct mock objects — no mock.module needed for injected deps
const mockCapture = mock.fn(async (_site: Site) => Buffer.from('fake-screenshot'))
const mockWriteFile = mock.fn(async (_path: string, _data: Buffer | string) => {})
const mockReadFile = mock.fn(async (_path: string) => Buffer.from('stored-png'))
const mockExists = mock.fn(async (_path: string) => false)
const mockGetText = mock.fn(async (_buffer: Buffer, _country: string) => '<h2>Content</h2>')

const mockFileStore: FileStore = {
  writeFile: mockWriteFile,
  readFile: mockReadFile,
  readdir: mock.fn(async () => []),
  exists: mockExists,
}

const mockAIClient: AIClient = { getText: mockGetText }
const mockCapturer = { capture: mockCapture }

let written: Set<string>

function defaultOptions(overrides?: { signal?: AbortSignal }) {
  return {
    sites: enabledSites,
    fileStore: mockFileStore,
    aiClient: mockAIClient,
    capturer: mockCapturer,
    ...overrides,
  }
}

describe('start', () => {
  beforeEach(() => {
    written = new Set()
    mockWriteFile.mock.mockImplementation(async (path: string) => {
      written.add(path)
    })
    mockExists.mock.mockImplementation(async (path: string) => written.has(path))
    mockReadFile.mock.mockImplementation(async () => Buffer.from('stored-png'))
    mockCapture.mock.mockImplementation(async () => Buffer.from('fake-screenshot'))
    mockGetText.mock.mockImplementation(async () => '<h2>Content</h2>')
    mockGenerate.mock.mockImplementation(async () => {})
    mockGenerateIndex.mock.mockImplementation(async () => {})
  })

  afterEach(() => {
    mockCapture.mock.resetCalls()
    mockWriteFile.mock.resetCalls()
    mockReadFile.mock.resetCalls()
    mockExists.mock.resetCalls()
    mockGetText.mock.resetCalls()
    mockGenerate.mock.resetCalls()
    mockGenerateIndex.mock.resetCalls()
  })

  describe('fresh run (no pre-existing files)', () => {
    it('captures and extracts all sites', async () => {
      const result = await start(defaultOptions())

      assert.equal(mockCapture.mock.callCount(), 2)
      assert.equal(mockGetText.mock.callCount(), 2)
      assert.equal(mockGenerate.mock.callCount(), 1)
      assert.equal(result.total, 2)
    })

    it('saves screenshot to file store after capture', async () => {
      await start(defaultOptions())

      const pngWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.png'))
      assert.equal(pngWrites.length, 2)
      assert.ok(String(pngWrites[0].arguments[0]).includes('site1.png'))
      assert.ok(Buffer.isBuffer(pngWrites[0].arguments[1]))
    })

    it('reads stored PNG and passes it to AI client for extraction', async () => {
      mockReadFile.mock.mockImplementation(async () => Buffer.from('read-back-png'))

      await start(defaultOptions())

      assert.equal(mockGetText.mock.callCount(), 2)
      const firstCall = mockGetText.mock.calls[0]
      assert.equal(firstCall.arguments[0].toString(), 'read-back-png')
      assert.equal(firstCall.arguments[1], 'CountryA')
      assert.equal(mockGetText.mock.calls[1].arguments[1], 'CountryB')
    })

    it('saves AI-extracted markdown to file store', async () => {
      await start(defaultOptions())

      const mdWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.md'))
      assert.equal(mdWrites.length, 2)
      assert.ok(String(mdWrites[0].arguments[0]).includes('site1.md'))
      assert.equal(mdWrites[0].arguments[1], '<h2>Content</h2>')
    })

    it('returns processed sites in result', async () => {
      const result = await start(defaultOptions())

      assert.equal(result.processed.length, 2)
      assert.equal(result.timedOut, false)
    })
  })

  describe('idempotent execution (skip existing files)', () => {
    it('skips capture when PNG already exists', async () => {
      mockExists.mock.mockImplementation(async (path: string) => {
        if (path.endsWith('.png')) return true
        return written.has(path)
      })

      await start(defaultOptions())

      assert.equal(mockCapture.mock.callCount(), 0)
      assert.equal(mockGetText.mock.callCount(), 2)
    })

    it('reads stored PNG for extraction when PNG exists but MD does not', async () => {
      mockExists.mock.mockImplementation(async (path: string) => path.endsWith('.png'))
      mockReadFile.mock.mockImplementation(async () => Buffer.from('existing-png'))

      await start(defaultOptions())

      assert.equal(mockCapture.mock.callCount(), 0)
      const firstCall = mockGetText.mock.calls[0]
      assert.equal(firstCall.arguments[0].toString(), 'existing-png')
    })

    it('skips entirely when both PNG and MD exist', async () => {
      mockExists.mock.mockImplementation(async () => true)

      await start(defaultOptions())

      assert.equal(mockCapture.mock.callCount(), 0)
      assert.equal(mockGetText.mock.callCount(), 0)
      assert.equal(mockGenerate.mock.callCount(), 1)
    })

    it('reports skipped count for fully processed sites', async () => {
      mockExists.mock.mockImplementation(async () => true)

      const result = await start(defaultOptions())

      assert.equal(result.skipped, 2)
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

      const result = await start(defaultOptions())

      assert.equal(mockGetText.mock.callCount(), 3)
      assert.equal(result.processed.length, 2)
    })

    it('gives up on site after max retries', async () => {
      mockGetText.mock.mockImplementation(async (_buffer: Buffer, country: string) => {
        if (country === 'CountryA') throw new Error('503 Service Unavailable')
        return '<h2>Content</h2>'
      })

      const result = await start(defaultOptions())

      assert.equal(mockGetText.mock.callCount(), 4)
      assert.equal(result.processed.length, 1)
    })

    it('reports failed sites with error message in result', async () => {
      mockGetText.mock.mockImplementation(async (_buffer: Buffer, country: string) => {
        if (country === 'CountryA') throw new Error('503 Service Unavailable')
        return '<h2>Content</h2>'
      })

      const result = await start(defaultOptions())

      assert.equal(result.failed.length, 1)
      assert.equal(result.failed[0].site, 'Site1 (original)')
      assert.equal(result.failed[0].error, '503 Service Unavailable')
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

      await start(defaultOptions())

      assert.equal(mockCapture.mock.callCount(), 2)
      assert.equal(mockGetText.mock.callCount(), 1)
    })

    it('reports capture failures in result', async () => {
      let callCount = 0
      mockCapture.mock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) throw new Error('net::ERR_CONNECTION_TIMED_OUT')
        return Buffer.from('fake-screenshot')
      })

      const result = await start(defaultOptions())

      assert.equal(result.failed.length, 1)
      assert.equal(result.failed[0].site, 'Site1 (original)')
      assert.equal(result.failed[0].error, 'net::ERR_CONNECTION_TIMED_OUT')
    })

    it('saves screenshot even when AI extraction fails for all sites', async () => {
      mockGetText.mock.mockImplementation(async () => {
        throw new Error('AI service unavailable')
      })

      await start(defaultOptions())

      const pngWrites = mockWriteFile.mock.calls.filter((c) => String(c.arguments[0]).endsWith('.png'))
      assert.equal(pngWrites.length, 2)
    })
  })

  describe('abort signal', () => {
    it('stops capture when signal is aborted', async () => {
      const controller = new AbortController()
      let callCount = 0
      mockCapture.mock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) controller.abort()
        return Buffer.from('fake-screenshot')
      })

      const result = await start(defaultOptions({ signal: controller.signal }))

      assert.equal(mockCapture.mock.callCount(), 1)
      assert.equal(result.timedOut, true)
    })

    it('stops extraction when signal is aborted', async () => {
      const controller = new AbortController()
      let callCount = 0
      mockGetText.mock.mockImplementation(async () => {
        callCount++
        if (callCount === 1) controller.abort()
        return '<h2>Content</h2>'
      })

      const result = await start(defaultOptions({ signal: controller.signal }))

      // Both captured, but only one extracted before abort
      assert.equal(mockCapture.mock.callCount(), 2)
      assert.equal(mockGetText.mock.callCount(), 1)
      assert.equal(result.timedOut, true)
    })

    it('generates report even when aborted before processing any site', async () => {
      const controller = new AbortController()
      controller.abort()

      const result = await start(defaultOptions({ signal: controller.signal }))

      assert.equal(mockCapture.mock.callCount(), 0)
      assert.equal(mockGetText.mock.callCount(), 0)
      assert.equal(mockGenerate.mock.callCount(), 1)
      assert.equal(result.timedOut, true)
    })

    it('runs to completion when no signal is provided', async () => {
      const result = await start(defaultOptions())

      assert.equal(result.timedOut, false)
      assert.equal(result.processed.length, 2)
    })

    it('updates root index after generating daily report', async () => {
      await start(defaultOptions())

      assert.equal(mockGenerateIndex.mock.callCount(), 1)
    })
  })
})
