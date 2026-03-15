import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { ScreenCapturer } from './screen-capturer.ts'
import { LocalStorage } from './storage/local-storage.ts'

describe('ScreenCapturer Integration', () => {
  const testDir = './out/test/media'
  const adapter = new LocalStorage(testDir)
  const capturer = new ScreenCapturer(adapter)

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('captures a screenshot of a real webpage', async () => {
    await capturer.capture('https://example.com', 'example', '2024-01-01')

    const screenshotPath = path.join(testDir, '2024-01-01', 'screenshots', 'example.png')
    const stat = await fs.stat(screenshotPath)

    assert.ok(stat.isFile())
    assert.ok(stat.size > 0, 'Screenshot should not be empty')
  })
})
