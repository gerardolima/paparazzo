import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it, mock } from 'node:test'
import { AIStructurer } from './ai-structurer.ts'
import { ScreenCapturer } from './screen-capturer.ts'
import { LocalStorage } from './storage/local-storage.ts'

describe('ScreenCapturer (INTEGRATION)', () => {
  const testDir = './out/test/media'
  const adapter = new LocalStorage(testDir)

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  let structurer: AIStructurer

  if (apiKey) {
    structurer = new AIStructurer(apiKey)
  } else {
    // Mock structurer for CI/local runs without a key
    structurer = {
      structureAndTranslate: mock.fn(async () => '# Mocked Structured News\n\nContent translated to English.'),
    } as unknown as AIStructurer
  }

  const capturer = new ScreenCapturer(adapter, structurer)

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('capture', () => {
    before(async () => {
      await capturer.capture('https://efe.com/', 'example', '2024-01-01')
    })

    it('captures a screenshot of a real webpage', async () => {
      const screenshotPath = path.join(testDir, '2024-01-01', 'example.png')
      const stat = await fs.stat(screenshotPath)

      assert.ok(stat.isFile())
      assert.ok(stat.size > 0, 'Screenshot should not be empty')
    })

    it('extracts text from a real webpage', async () => {
      const textPath = path.join(testDir, '2024-01-01', 'example.md')
      const textStat = await fs.stat(textPath)
      assert.ok(textStat.isFile())
      const content = await fs.readFile(textPath, 'utf8')
      assert.ok(content.length > 0, 'Extracted text should not be empty')
    })
  })
})
