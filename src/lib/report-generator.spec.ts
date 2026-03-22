import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { Site } from './data/sites.ts'
import { ReportGenerator } from './report-generator.ts'
import type { Storage } from './storage/storage.ts'

// biome-ignore lint/suspicious/noExplicitAny: helper for node:test mock type casting
type MockFn = ReturnType<typeof mock.fn> & { mock: any }

const sites: Site[] = [
  {
    slug: 'efe-esp',
    name: 'EFE',
    description: 'Agencia EFE',
    country: 'Espanha',
    version: 'original',
    url: 'https://efe.com/',
    enabled: true,
  },
  {
    slug: 'ansa-ita',
    name: 'ANSA',
    description: 'Agenzia Nazionale Stampa Associata',
    country: 'Itália',
    version: 'original',
    url: 'https://www.ansa.it/',
    enabled: true,
  },
  {
    slug: 'lusa-eng',
    name: 'Lusa',
    description: 'Agência de Notícias',
    country: 'Espanha',
    version: 'english',
    url: 'https://www.lusa.pt/lusanews',
    enabled: true,
  },
]

describe('ReportGenerator', () => {
  const mockStorage = {
    saveScreenshot: mock.fn(async (_filename: string, _data: Buffer): Promise<void> => {}),
    saveText: mock.fn(async (_filename: string, _content: string): Promise<void> => {}),
    listEntries: mock.fn(async (_dateStr: string): Promise<string[]> => []),
  } as const satisfies Storage

  beforeEach(() => {
    mockStorage.listEntries.mock.mockImplementation(async () => [
      'efe-esp.png',
      'efe-esp.md',
      'ansa-ita.png',
      'lusa-eng.png',
      'lusa-eng.md',
    ])
  })

  afterEach(() => {
    mockStorage.saveText.mock.resetCalls()
    mockStorage.listEntries.mock.resetCalls()
  })

  describe('generate', () => {
    it('generates HTML report with cards for each screenshot', async () => {
      const generator = new ReportGenerator(mockStorage)
      await generator.generate('2024-01-01', sites)

      const saveTextFn = mockStorage.saveText as unknown as MockFn
      assert.equal(saveTextFn.mock.callCount(), 1)

      const [filename, html] = saveTextFn.mock.calls[0].arguments as [string, string]
      assert.equal(filename, '2024-01-01/index.html')
      assert.ok(html.includes('efe-esp.png'))
      assert.ok(html.includes('ansa-ita.png'))
      assert.ok(html.includes('lusa-eng.png'))
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
      ;(mockStorage.listEntries as unknown as MockFn).mock.mockImplementation(async () => ['ansa-ita.png'])

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
