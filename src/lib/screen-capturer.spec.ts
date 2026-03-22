import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { AIClient } from './ai-client.ts'
import type { Site } from './config/sites.ts'
import type { Storage } from './storage/storage.ts'

// biome-ignore lint/suspicious/noExplicitAny: helper for node:test mock type casting
type MockFn = ReturnType<typeof mock.fn> & { mock: any }

const mockPage = {
  route: mock.fn(async () => {}),
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
  const mockStorage: Storage = {
    saveScreenshot: mock.fn(async () => {}),
    saveText: mock.fn(async () => {}),
    listEntries: mock.fn(async () => []),
  }

  const mockStructurer = {
    structureAndTranslate: mock.fn(async () => '# Translated headlines'),
  } as unknown as AIClient

  beforeEach(() => {
    mockPage.screenshot.mock.mockImplementation(async () => Buffer.from('fake-png'))
    ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.mockImplementation(
      async () => '# Translated headlines',
    )
  })

  afterEach(() => {
    mockChromium.launch.mock.resetCalls()
    mockBrowser.close.mock.resetCalls()
    mockPage.route.mock.resetCalls()
    ;(mockStorage.saveScreenshot as unknown as MockFn).mock.resetCalls()
    ;(mockStorage.saveText as unknown as MockFn).mock.resetCalls()
    ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.resetCalls()
  })

  describe('capture', () => {
    it('saves screenshot using slug-based filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture(testSite, '2024-06-15')

      const saveFn = mockStorage.saveScreenshot as unknown as MockFn
      assert.equal(saveFn.mock.callCount(), 1)
      assert.equal(saveFn.mock.calls[0].arguments[0], '2024-06-15/example-agency.png')
    })

    it('passes screenshot buffer and country to AI structurer', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture(testSite, '2024-06-15')

      const structureFn = mockStructurer.structureAndTranslate as unknown as MockFn
      assert.equal(structureFn.mock.callCount(), 1)
      const passedBuffer = structureFn.mock.calls[0].arguments[0] as Buffer
      assert.equal(passedBuffer.toString(), 'fake-png')
      assert.equal(structureFn.mock.calls[0].arguments[1], 'Testland')
    })

    it('saves translated markdown using slug-based filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture(testSite, '2024-06-15')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      assert.equal(saveTextFn.mock.callCount(), 1)
      assert.equal(saveTextFn.mock.calls[0].arguments[0], '2024-06-15/example-agency.md')
      assert.equal(saveTextFn.mock.calls[0].arguments[1], '# Translated headlines')
    })

    it('uses site slug for english version sites', async () => {
      const englishSite: Site = { ...testSite, slug: 'example-agency-eng', version: 'english' }
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture(englishSite, '2024-06-15')

      const saveFn = mockStorage.saveScreenshot as unknown as MockFn
      assert.equal(saveFn.mock.calls[0].arguments[0], '2024-06-15/example-agency-eng.png')
    })

    it('configures route interception to block third-party resources before navigation', async () => {
      const callOrder: string[] = []
      mockPage.route.mock.mockImplementation(async () => {
        callOrder.push('route')
      })
      mockPage.goto.mock.mockImplementation(async () => {
        callOrder.push('goto')
      })

      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture(testSite, '2024-06-15')

      assert.equal(mockPage.route.mock.callCount(), 1)
      assert.equal(mockPage.route.mock.calls[0].arguments[0], '**/*')
      assert.equal(typeof mockPage.route.mock.calls[0].arguments[1], 'function')
      assert.deepEqual(callOrder, ['route', 'goto'])
    })

    it('closes browser even when AI structurer throws', async () => {
      ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.mockImplementation(async () => {
        throw new Error('AI service unavailable')
      })

      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await assert.rejects(() => capturer.capture(testSite, '2024-06-15'), {
        message: 'AI service unavailable',
      })

      assert.equal(mockBrowser.close.mock.callCount(), 1)
    })
  })
})
