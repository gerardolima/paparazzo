import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { Site } from './data/sites.ts'
import type { AIClient } from './ia-client/ai-client.ts'
import type { Storage } from './storage/storage.ts'

const mockPage = {
  route: mock.fn(async (_url: string, _handler: Function) => {}),
  setViewportSize: mock.fn(async () => {}),
  goto: mock.fn(async () => {}),
  locator: mock.fn(() => ({ count: async () => 0, first: () => ({ click: async () => {} }) })),
  screenshot: mock.fn(async () => Buffer.from('fake-png')),
}

const mockContext = { newPage: mock.fn(async () => mockPage) }

const mockBrowser = {
  newContext: mock.fn(async () => mockContext),
  close: mock.fn(async () => {}),
}

const mockChromium = { launch: mock.fn(async () => mockBrowser) }

mock.module('playwright', { namedExports: { chromium: mockChromium } })

// Must import after mock.module
const { ScreenCapturer } = await import('./screen-capturer.ts')

const testSite: Site = {
  slug: 'example-agency',
  name: 'Example Agency',
  description: 'Test description',
  country: 'Testland',
  version: 'original',
  url: 'https://example.com',
  enabled: true,
}

describe('ScreenCapturer', () => {
  const mockStorage = {
    saveScreenshot: mock.fn(async (_filename: string, _data: Buffer) => {}),
    saveText: mock.fn(async (_filename: string, _content: string) => {}),
    readText: mock.fn(async (_filename: string): Promise<string> => ''),
    listEntries: mock.fn(async (_dateStr: string): Promise<string[]> => []),
  } as const satisfies Storage

  const mockAIClient = {
    structureAndTranslate: mock.fn(
      async (_screenshotBuffer: Buffer, _country: string) => '<h2>Translated headlines</h2>',
    ),
  } as const satisfies AIClient

  beforeEach(() => {
    mockPage.screenshot.mock.mockImplementation(async () => Buffer.from('fake-png'))
    mockAIClient.structureAndTranslate.mock.mockImplementation(async () => '<h2>Translated headlines</h2>')
  })

  afterEach(() => {
    mockChromium.launch.mock.resetCalls()
    mockBrowser.close.mock.resetCalls()
    mockPage.route.mock.resetCalls()
    mockStorage.saveScreenshot.mock.resetCalls()
    mockStorage.saveText.mock.resetCalls()
    mockAIClient.structureAndTranslate.mock.resetCalls()
  })

  describe('capture', () => {
    it('saves screenshot using slug-based filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await capturer.capture(testSite, '2024-06-15')

      assert.equal(mockStorage.saveScreenshot.mock.callCount(), 1)
      assert.equal(mockStorage.saveScreenshot.mock.calls[0].arguments[0], '2024-06-15/example-agency.png')
    })

    it('passes screenshot buffer and country to AI structurer', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await capturer.capture(testSite, '2024-06-15')

      assert.equal(mockAIClient.structureAndTranslate.mock.callCount(), 1)
      const passedBuffer = mockAIClient.structureAndTranslate.mock.calls[0].arguments[0] as Buffer
      assert.equal(passedBuffer.toString(), 'fake-png')
      assert.equal(mockAIClient.structureAndTranslate.mock.calls[0].arguments[1], 'Testland')
    })

    it('saves translated markdown using slug-based filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await capturer.capture(testSite, '2024-06-15')

      assert.equal(mockStorage.saveText.mock.callCount(), 1)
      assert.equal(mockStorage.saveText.mock.calls[0].arguments[0], '2024-06-15/example-agency.md')
      assert.equal(mockStorage.saveText.mock.calls[0].arguments[1], '<h2>Translated headlines</h2>')
    })

    it('uses site slug for english version sites', async () => {
      const englishSite: Site = { ...testSite, slug: 'example-agency-eng', version: 'english' }
      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await capturer.capture(englishSite, '2024-06-15')

      assert.equal(mockStorage.saveScreenshot.mock.calls[0].arguments[0], '2024-06-15/example-agency-eng.png')
    })

    it('configures route interception to block third-party resources before navigation', async () => {
      const callOrder: string[] = []
      mockPage.route.mock.mockImplementation(async () => {
        callOrder.push('route')
      })
      mockPage.goto.mock.mockImplementation(async () => {
        callOrder.push('goto')
      })

      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await capturer.capture(testSite, '2024-06-15')

      assert.equal(mockPage.route.mock.callCount(), 1)
      assert.equal(mockPage.route.mock.calls[0].arguments[0], '**/*')
      assert.equal(typeof mockPage.route.mock.calls[0].arguments[1], 'function')
      assert.deepEqual(callOrder, ['route', 'goto'])
    })

    it('closes browser even when AI structurer throws', async () => {
      mockAIClient.structureAndTranslate.mock.mockImplementation(async () => {
        throw new Error('AI service unavailable')
      })

      const capturer = new ScreenCapturer(mockStorage, mockAIClient)
      await assert.rejects(() => capturer.capture(testSite, '2024-06-15'), {
        message: 'AI service unavailable',
      })

      assert.equal(mockBrowser.close.mock.callCount(), 1)
    })
  })
})
