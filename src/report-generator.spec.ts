import assert from 'node:assert/strict'
import { describe, it, mock } from 'node:test'
import { ReportGenerator } from './report-generator.ts'
import type { Storage } from './storage/storage.ts'

describe('ReportGenerator', () => {
  it('generates an HTML report with cards for screenshots', async () => {
    const mockStorage: Storage = {
      saveScreenshot: mock.fn(),
      saveText: mock.fn(),
      listEntries: mock.fn(async () => ['site1.png', 'site1.md', 'site2.png']),
    }

    const generator = new ReportGenerator(mockStorage)
    const dateStr = '2024-01-01'
    await generator.generate(dateStr)

    // Verify listEntries was called with correct date
    // biome-ignore lint/suspicious/noExplicitAny: node:test mock type casting
    const listCalls = (mockStorage.listEntries as any).mock.calls
    assert.equal(listCalls.length, 1)
    assert.equal(listCalls[0].arguments[0], dateStr)

    // Verify saveText was called with index.html
    // biome-ignore lint/suspicious/noExplicitAny: node:test mock type casting
    const saveCalls = (mockStorage.saveText as any).mock.calls
    assert.equal(saveCalls.length, 1)
    const [filename, html] = saveCalls[0].arguments
    assert.equal(filename, `${dateStr}/index.html`)

    // Verify HTML content contains site names and links
    assert.ok(html.includes('site1'))
    assert.ok(html.includes('site2'))
    assert.ok(html.includes('View Translated Text')) // for site1
    assert.ok(html.includes('site1.md'))
    assert.ok(html.includes('site1.png'))
    assert.ok(html.includes('site2.png'))
  })
})
