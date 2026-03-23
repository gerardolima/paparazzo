import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it, mock } from 'node:test'
import { FileStoreLocal } from './file-store/file-store-local.ts'
import type { AIClient } from './ia-client/ai-client.ts'
import { AIClientGoogle } from './ia-client/ai-client-google.ts'
import { ScreenCapturer } from './screen-capturer.ts'
import type { Site } from './site-repository/site-repository.ts'

describe('ScreenCapturer (INTEGRATION)', () => {
  const testDir = './out/test/media'
  const fileStore = new FileStoreLocal(testDir)

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  let aiClient: AIClient

  if (apiKey) {
    aiClient = new AIClientGoogle(apiKey)
  } else {
    // Mock structurer for CI/local runs without a key
    aiClient = {
      structureAndTranslate: mock.fn(async () => '# Mocked Structured News\n\nContent translated to English.'),
    } as const satisfies AIClient
  }

  const capturer = new ScreenCapturer(fileStore, aiClient)

  const testSite: Site = {
    slug: 'efe-esp',
    name: 'EFE',
    description: 'Agencia EFE',
    country: 'Espanha',
    version: 'original',
    url: 'https://efe.com/',
    enabled: true,
  }

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  describe('capture', () => {
    before(async () => {
      await capturer.capture(testSite, '2024-01-01')
    })

    it('captures a screenshot of a real webpage', async () => {
      const screenshotPath = path.join(testDir, '2024-01-01', 'efe-esp.png')
      const stat = await fs.stat(screenshotPath)

      assert.ok(stat.isFile())
      assert.ok(stat.size > 0, 'Screenshot not be empty')
    })

    it('extracts text from a real webpage', async () => {
      const textPath = path.join(testDir, '2024-01-01', 'efe-esp.md')
      const textStat = await fs.stat(textPath)
      assert.ok(textStat.isFile())
      const content = await fs.readFile(textPath, 'utf8')
      assert.ok(content.length > 0, 'Extracted text not be empty')
    })
  })
})
