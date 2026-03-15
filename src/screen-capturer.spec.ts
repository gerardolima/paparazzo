import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { ScreenCapturer } from './screen-capturer.ts'
import type { Storage } from './storage/storage.ts'

// Note: Playwright's chromium object is difficult to mock flawlessly in native node:test
// without a larger test double setup, but we can verify the method signature exists.
describe('ScreenCapturer', () => {
  it('initializes with a storage adapter', () => {
    const mockStorage: Storage = {
      saveScreenshot: mock.fn(),
      saveText: mock.fn(),
    }

    const capturer = new ScreenCapturer(mockStorage)
    assert.ok(capturer)
    assert.equal(typeof capturer.capture, 'function')
  })
})
