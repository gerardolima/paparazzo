import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { Site } from './config/sites.ts'
import { ReportGenerator } from './report-generator.ts'
import type { Storage } from './storage/storage.ts'

// biome-ignore lint/suspicious/noExplicitAny: helper for node:test mock type casting
type MockFn = ReturnType<typeof mock.fn> & { mock: any }

const sites: Site[] = [
  {
    name: 'EFE',
    description: 'Agencia EFE',
    country: 'Espanha',
    version: 'original',
    url: 'https://efe.com/',
    enabled: true,
  },
  {
    name: 'ANSA',
    description: 'Agenzia Nazionale Stampa Associata',
    country: 'Itália',
    version: 'original',
    url: 'https://www.ansa.it/',
    enabled: true,
  },
  {
    name: 'Lusa',
    description: 'Agência de Notícias',
    country: 'Espanha',
    version: 'english',
    url: 'https://www.lusa.pt/lusanews',
    enabled: true,
  },
]

describe('ReportGenerator', () => {
  const mockStorage: Storage = {
    saveScreenshot: mock.fn(async () => {}),
    saveText: mock.fn(async () => {}),
    listEntries: mock.fn(async () => []),
  }

  beforeEach(() => {
    ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => [
      'efe.png',
      'efe.md',
      'ansa.png',
      'lusa-english.png',
      'lusa-english.md',
    ])
  })

  afterEach(() => {
    ;(mockStorage.saveText as unknown as MockFn).mock.resetCalls()
    ;(mockStorage.listEntries as unknown as MockFn).mock.resetCalls()
  })

  describe('generate', () => {
    it('generates HTML report with cards for each screenshot', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      assert.equal(saveTextFn.mock.callCount(), 1)

      const [filename, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.equal(filename, '2024-01-01/index.html')
      assert.ok(html.includes('efe.png'))
      assert.ok(html.includes('ansa.png'))
      assert.ok(html.includes('lusa-english.png'))
      assert.ok(html.includes('View Translated Text'))
    })

    it('renders country section headers', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<h2>Espanha</h2>'))
      assert.ok(html.includes('<h2>Itália</h2>'))
    })

    it('renders description when present', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('Agencia EFE'))
      assert.ok(html.includes('Agenzia Nazionale Stampa Associata'))
    })

    it('generates HTML with no cards when entry list is empty', async () => {
      ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => [])

      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<!DOCTYPE html>'))
      assert.ok(!html.includes('<div class="card">'))
    })

    it('omits "View Translated Text" link when screenshot has no matching markdown', async () => {
      ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => ['ansa.png'])

      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('ANSA'))
      assert.ok(!html.includes('View Translated Text'))
    })

    it('includes the date in the HTML title', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-07-04', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      const [, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<title>Paparazzo Daily Report - 2024-07-04</title>'))
    })
  })
})
