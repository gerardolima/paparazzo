import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import type { Site } from './data/sites.ts'
import { FileStoreLocal } from './file-store/file-store-local.ts'
import { ReportGenerator } from './report-generator.ts'

describe('ReportGenerator (INTEGRATION)', () => {
  const testDir = './out/test/gallery'
  const fileStore = new FileStoreLocal(testDir)
  const generator = new ReportGenerator(fileStore)
  const dateStr = '2024-01-01'

  const sites: Site[] = [
    {
      slug: 'test1',
      name: 'Test1',
      description: 'First agency',
      country: 'CountryA',
      version: 'original',
      url: 'https://test1.com',
      enabled: true,
    },
    {
      slug: 'test2',
      name: 'Test2',
      description: null,
      country: 'CountryB',
      version: 'original',
      url: 'https://test2.com',
      enabled: true,
    },
  ]

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
    // Seed some data using slugs that match the sites
    await fileStore.writeFile(`${dateStr}/test1.png`, Buffer.from('img1'))
    await fileStore.writeFile(`${dateStr}/test1.md`, '<h2>Test1 Headlines</h2><p>Breaking news</p>')
    await fileStore.writeFile(`${dateStr}/test2.png`, Buffer.from('img2'))
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('generates the index.html file in the correct directory', async () => {
    await generator.generate(dateStr, sites)

    const indexPath = path.join(testDir, dateStr, 'index.html')
    const stat = await fs.stat(indexPath)
    assert.ok(stat.isFile())

    const html = await fs.readFile(indexPath, 'utf-8')
    assert.ok(html.includes('test1.png'))
    assert.ok(html.includes('test2.png'))
    assert.ok(html.includes('<h2>Test1 Headlines</h2><p>Breaking news</p>'))
    assert.ok(html.includes('Paparazzo Daily Report'))
  })
})
