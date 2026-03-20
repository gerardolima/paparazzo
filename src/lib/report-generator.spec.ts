import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import { ReportGenerator } from './report-generator.ts'
import type { Storage } from './storage/storage.ts'

// biome-ignore lint/suspicious/noExplicitAny: helper for node:test mock type casting
type MockFn = ReturnType<typeof mock.fn> & { mock: any }

describe('ReportGenerator', () => {
  const mockStorage: Storage = {
    saveScreenshot: mock.fn(async () => {}),
    saveText: mock.fn(async () => {}),
    listEntries: mock.fn(async () => []),
  }

  beforeEach(() => {
    ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => [
      'site1.png',
      'site1.md',
      'site2.png',
    ])
  })

  afterEach(() => {
    ;(mockStorage.saveText as unknown as MockFn).mock.resetCalls()
    ;(mockStorage.listEntries as unknown as MockFn).mock.resetCalls()
  })

  describe('generate', () => {
    it('generates HTML report with cards for each screenshot', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      assert.equal(saveTextFn.mock.callCount(), 1)

      const [filename, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.equal(filename, '2024-01-01/index.html')
      assert.ok(html.includes('site1.png'))
      assert.ok(html.includes('site2.png'))
      assert.ok(html.includes('site1.md'))
      assert.ok(html.includes('View Translated Text'))
    })

    it('generates HTML with no cards when entry list is empty', async () => {
      ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => [])

      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<!DOCTYPE html>'))
      assert.ok(!html.includes('<div class="card">'))
    })

    it('omits "View Translated Text" link when screenshot has no matching markdown', async () => {
      ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => ['orphan.png'])

      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('orphan'))
      assert.ok(!html.includes('View Translated Text'))
    })

    it('includes the date in the HTML title', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-07-04')

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<title>Paparazzo Daily Report - 2024-07-04</title>'))
    })
  })
})
