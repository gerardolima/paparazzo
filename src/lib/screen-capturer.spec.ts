import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { AIStructurer } from './ai-structurer.ts'
import type { Storage } from './storage/storage.ts'

// biome-ignore lint/suspicious/noExplicitAny: helper for node:test mock type casting
type MockFn = ReturnType<typeof mock.fn> & { mock: any }

const mockPage = {
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

describe('ScreenCapturer', () => {
  const mockStorage: Storage = {
    saveScreenshot: mock.fn(async () => {}),
    saveText: mock.fn(async () => {}),
    listEntries: mock.fn(async () => []),
  }

  const mockStructurer = {
    structureAndTranslate: mock.fn(async () => '# Translated headlines'),
  } as unknown as AIStructurer

  beforeEach(() => {
    mockPage.screenshot.mock.mockImplementation(async () => Buffer.from('fake-png'))
    ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.mockImplementation(
      async () => '# Translated headlines',
    )
  })

  afterEach(() => {
    mockChromium.launch.mock.resetCalls()
    mockBrowser.close.mock.resetCalls()
    ;(mockStorage.saveScreenshot as unknown as MockFn).mock.resetCalls()
    ;(mockStorage.saveText as unknown as MockFn).mock.resetCalls()
    ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.resetCalls()
  })

  describe('capture', () => {
    it('saves screenshot with correct filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture('https://example.com', 'example', '2024-06-15')

      const saveFn = mockStorage.saveScreenshot as unknown as MockFn
      assert.equal(saveFn.mock.callCount(), 1)
      assert.equal(saveFn.mock.calls[0].arguments[0], '2024-06-15/example.png')
    })

    it('passes screenshot buffer to AI structurer', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture('https://example.com', 'example', '2024-06-15')

      const structureFn = mockStructurer.structureAndTranslate as unknown as MockFn
      assert.equal(structureFn.mock.callCount(), 1)
      const passedBuffer = structureFn.mock.calls[0].arguments[0] as Buffer
      assert.equal(passedBuffer.toString(), 'fake-png')
    })

    it('saves translated markdown with correct filename', async () => {
      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await capturer.capture('https://example.com', 'example', '2024-06-15')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      assert.equal(saveTextFn.mock.callCount(), 1)
      assert.equal(saveTextFn.mock.calls[0].arguments[0], '2024-06-15/example.md')
      assert.equal(saveTextFn.mock.calls[0].arguments[1], '# Translated headlines')
    })

    it('closes browser even when AI structurer throws', async () => {
      ;(mockStructurer.structureAndTranslate as unknown as MockFn).mock.mockImplementation(async () => {
        throw new Error('AI service unavailable')
      })

      const capturer = new ScreenCapturer(mockStorage, mockStructurer)
      await assert.rejects(() => capturer.capture('https://example.com', 'example', '2024-06-15'), {
        message: 'AI service unavailable',
      })

      assert.equal(mockBrowser.close.mock.callCount(), 1)
    })
  })
})
