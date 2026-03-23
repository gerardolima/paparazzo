import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it, mock } from 'node:test'
import type { FileStore } from './file-store/file-store.ts'
import { ReportGenerator } from './report-generator.ts'
import type { Site } from './site-repository/site-repository.ts'

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
  const mockFileStore = {
    writeFile: mock.fn(async (_path: string, _data: Buffer | string): Promise<void> => {}),
    readFile: mock.fn(async (_path: string): Promise<string> => ''),
    readdir: mock.fn(async (_path: string): Promise<string[]> => []),
  } as const satisfies FileStore

  beforeEach(() => {
    mockFileStore.readdir.mock.mockImplementation(async () => [
      'efe-esp.png',
      'efe-esp.md',
      'ansa-ita.png',
      'lusa-eng.png',
      'lusa-eng.md',
    ])
    mockFileStore.readFile.mock.mockImplementation(async (filename: string) => {
      if (filename.includes('efe-esp')) return '<h2>EFE Headlines</h2><p>Spain news</p>'
      if (filename.includes('lusa-eng')) return '<h2>Lusa Headlines</h2><p>Portugal news</p>'
      return ''
    })
  })

  afterEach(() => {
    mockFileStore.writeFile.mock.resetCalls()
    mockFileStore.readdir.mock.resetCalls()
    mockFileStore.readFile.mock.resetCalls()
  })

  describe('generate', () => {
    it('renders card header with name, language label, and live site link', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('EFE - Original -'))
      assert.ok(html.includes('<a href="https://efe.com/"'))
      assert.ok(html.includes('Lusa - English -'))
      assert.ok(html.includes('<a href="https://www.lusa.pt/lusanews"'))
    })

    it('renders inline extracted text within card', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<h2>EFE Headlines</h2><p>Spain news</p>'))
      assert.ok(html.includes('<h2>Lusa Headlines</h2><p>Portugal news</p>'))
    })

    it('renders side-by-side image and extracted text layout', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<img src="efe-esp.png"'))
      assert.ok(html.includes('class="extracted-text"'))
    })

    it('uses fixed 2-column grid', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('grid-template-columns: repeat(2, 1fr)'))
    })

    it('reads text content for each screenshot with matching file', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const readFileFn = mockFileStore.readFile as unknown as MockFn
      assert.equal(readFileFn.mock.callCount(), 2)

      const calledWith = readFileFn.mock.calls.map((c: { arguments: string[] }) => c.arguments[0])
      assert.ok(calledWith.includes('2024-01-01/efe-esp.md'))
      assert.ok(calledWith.includes('2024-01-01/lusa-eng.md'))
    })

    it('renders empty extracted text div when no markdown exists', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]

      // Find the ANSA card — it has no .md file
      const ansaCardStart = html.indexOf('ANSA - Original')
      assert.ok(ansaCardStart !== -1, 'ANSA card header exists')

      // The extracted-text div is present but empty
      const nextCardStart = html.indexOf('<div class="card">', ansaCardStart)
      const ansaCard =
        nextCardStart !== -1 ? html.substring(ansaCardStart, nextCardStart) : html.substring(ansaCardStart)
      assert.ok(ansaCard.includes('<div class="extracted-text"></div>'))
    })

    it('renders country section headers', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<h2>Espanha</h2>'))
      assert.ok(html.includes('<h2>Itália</h2>'))
    })

    it('generates HTML with no cards when entry list is empty', async () => {
      ;(mockFileStore.readdir as unknown as MockFn).mock.mockImplementation(async () => [])

      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-01-01', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<!DOCTYPE html>'))
      assert.ok(!html.includes('<div class="card">'))
    })

    it('includes the date in the HTML title', async () => {
      const generator = new ReportGenerator(mockFileStore)
      await generator.generate('2024-07-04', sites)

      const writeFileFn = mockFileStore.writeFile as unknown as MockFn
      const [, html] = writeFileFn.mock.calls[0].arguments as [string, string]
      assert.ok(html.includes('<title>Paparazzo Daily Report - 2024-07-04</title>'))
    })
  })
})
