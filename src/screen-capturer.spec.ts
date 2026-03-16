import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import type { AIStructurer } from './ai-structurer.ts'
import { ScreenCapturer } from './screen-capturer.ts'
import type { Storage } from './storage/storage.ts'

describe('ScreenCapturer', () => {
  it('initializes with a storage adapter and ai structurer', () => {
    const mockStorage: Storage = {
      saveScreenshot: mock.fn(),
      saveText: mock.fn(),
    }

    const mockStructurer = {
      structureAndTranslate: mock.fn(),
    } as unknown as AIStructurer

    const capturer = new ScreenCapturer(mockStorage, mockStructurer)
    assert.ok(capturer)
    assert.equal(typeof capturer.capture, 'function')
  })
})
