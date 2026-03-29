import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { Site } from './site-repository/site-repository.ts'

const mockRm = mock.fn(async (_path: string, _options: { recursive: boolean; force: boolean }) => {})
mock.module('node:fs/promises', { namedExports: { rm: mockRm } })

const mockPage = {
  route: mock.fn(async (_url: string, _handler: (_: string) => void) => {}),
  setViewportSize: mock.fn(async () => {}),
  goto: mock.fn(async () => {}),
  locator: mock.fn(() => ({ count: async () => 0, first: () => ({ click: async () => {} }) })),
  screenshot: mock.fn(async () => Buffer.from('fake-png')),
}

const mockContext = {
  newPage: mock.fn(async () => mockPage),
  close: mock.fn(async () => {}),
}

const mockChromium = { launchPersistentContext: mock.fn(async (_dir: string, _opts: unknown) => mockContext) }

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
  beforeEach(() => {
    mockPage.goto.mock.mockImplementation(async () => {})
    mockPage.screenshot.mock.mockImplementation(async () => Buffer.from('fake-png'))
  })

  afterEach(() => {
    mockChromium.launchPersistentContext.mock.resetCalls()
    mockContext.close.mock.resetCalls()
    mockPage.route.mock.resetCalls()
    mockPage.goto.mock.resetCalls()
    mockPage.screenshot.mock.resetCalls()
    mockRm.mock.resetCalls()
  })

  describe('capture', () => {
    it('returns the screenshot buffer', async () => {
      const capturer = new ScreenCapturer()
      const result = await capturer.capture(testSite)

      assert.ok(Buffer.isBuffer(result))
      assert.equal(result.toString(), 'fake-png')
    })

    it('configures route interception to block third-party resources before navigation', async () => {
      const callOrder: string[] = []
      mockPage.route.mock.mockImplementation(async () => {
        callOrder.push('route')
      })
      mockPage.goto.mock.mockImplementation(async () => {
        callOrder.push('goto')
      })

      const capturer = new ScreenCapturer()
      await capturer.capture(testSite)

      assert.equal(mockPage.route.mock.callCount(), 1)
      assert.equal(mockPage.route.mock.calls[0].arguments[0], '**/*')
      assert.equal(typeof mockPage.route.mock.calls[0].arguments[1], 'function')
      assert.deepEqual(callOrder, ['route', 'goto'])
    })

    it('launches browser in a directory unique to the site slug', async () => {
      const capturer = new ScreenCapturer()
      await capturer.capture(testSite)

      assert.equal(mockChromium.launchPersistentContext.mock.callCount(), 1)
      const dirArg = mockChromium.launchPersistentContext.mock.calls[0].arguments[0]
      assert.ok(dirArg.includes('example-agency'), `expected dir to contain slug, got: ${dirArg}`)
    })

    it('closes browser context after capture', async () => {
      const capturer = new ScreenCapturer()
      await capturer.capture(testSite)

      assert.equal(mockContext.close.mock.callCount(), 1)
    })

    it('closes browser context even when page navigation throws', async () => {
      mockPage.goto.mock.mockImplementation(async () => {
        throw new Error('Navigation failed')
      })

      const capturer = new ScreenCapturer()
      await assert.rejects(() => capturer.capture(testSite), {
        message: 'Navigation failed',
      })

      assert.equal(mockContext.close.mock.callCount(), 1)
    })

    it('removes browser data directory after capture', async () => {
      const capturer = new ScreenCapturer()
      await capturer.capture(testSite)

      assert.equal(mockRm.mock.callCount(), 1)
      const rmPath = mockRm.mock.calls[0].arguments[0]
      assert.ok(rmPath.includes('example-agency'), `expected rm path to contain slug, got: ${rmPath}`)
      assert.deepEqual(mockRm.mock.calls[0].arguments[1], { recursive: true, force: true })
    })

    it('removes browser data directory even when capture throws', async () => {
      mockPage.goto.mock.mockImplementation(async () => {
        throw new Error('Navigation failed')
      })

      const capturer = new ScreenCapturer()
      await assert.rejects(() => capturer.capture(testSite))

      assert.equal(mockRm.mock.callCount(), 1)
      const rmPath = mockRm.mock.calls[0].arguments[0]
      assert.ok(rmPath.includes('example-agency'), `expected rm path to contain slug, got: ${rmPath}`)
      assert.deepEqual(mockRm.mock.calls[0].arguments[1], { recursive: true, force: true })
    })
  })
})
