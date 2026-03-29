import type { FileStore } from './file-store/file-store.ts'
import type { Site } from './site-repository/site-repository.ts'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export class ReportGenerator {
  readonly #fileStore: FileStore

  constructor(fileStore: FileStore) {
    this.#fileStore = fileStore
  }

  async generateIndex(): Promise<void> {
    const dirs = await this.#fileStore.readdir('', 'directory')
    const dates = dirs.filter((d) => DATE_PATTERN.test(d)).sort((a, b) => b.localeCompare(a))

    const listHtml = dates.map((d) => `      <li><a href="${d}/index.html">${d}</a></li>`).join('\n')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paparazzo Reports</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f4f9; padding: 20px; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
        li { margin: 8px 0; font-size: 1.1rem; }
    </style>
</head>
<body>
    <h1>Paparazzo Reports</h1>
    <ul>
${listHtml}
    </ul>
</body>
</html>`

    await this.#fileStore.writeFile('index.html', html)
  }

  async generate(dateStr: string, sites: Site[]): Promise<void> {
    const files = await this.#fileStore.readdir(dateStr)
    const screenshots = files.filter((f) => f.endsWith('.png'))

    const slugToSite = new Map<string, Site>()
    for (const site of sites) {
      slugToSite.set(site.slug, site)
    }

    // Read all available .md files in parallel
    const slugToContent = new Map<string, string>()
    await Promise.all(
      screenshots
        .filter((s) => files.includes(s.replace('.png', '.md')))
        .map(async (s) => {
          const slug = s.replace('.png', '')
          const buffer = await this.#fileStore.readFile(`${dateStr}/${slug}.md`)
          const content = buffer.toString('utf-8')
          slugToContent.set(slug, content)
        }),
    )

    // Group screenshots by country
    const byCountry = new Map<string, string[]>()
    for (const screenshot of screenshots) {
      const slug = screenshot.replace('.png', '')
      const site = slugToSite.get(slug)
      const country = site?.country ?? 'Unknown'
      const group = byCountry.get(country) ?? []
      group.push(screenshot)
      byCountry.set(country, group)
    }

    // Sort countries alphabetically
    const sortedCountries = [...byCountry.keys()].sort((a, b) => a.localeCompare(b))

    const sectionsHtml = sortedCountries
      .map((country) => {
        const countryScreenshots = byCountry.get(country) ?? []
        const cardsHtml = countryScreenshots
          .map((screenshot) => {
            const slug = screenshot.replace('.png', '')
            const site = slugToSite.get(slug)
            const name = site?.name ?? slug
            const url = site?.url ?? ''
            const languageLabel = site?.version === 'english' ? 'English' : 'Original'
            const content = slugToContent.get(slug)

            return `
        <div class="card">
          <h3>${name} - ${languageLabel} - <a href="${url}" target="_blank">${url}</a></h3>
          <div class="card-body">
            <div class="card-image">
              <a href="${screenshot}" target="_blank">
                <img src="${screenshot}" alt="${name}">
              </a>
            </div>
            <div class="extracted-text">${content ?? ''}</div>
          </div>
        </div>`
          })
          .join('\n')

        return `
      <h2>${country}</h2>
      <div class="grid">
        ${cardsHtml}
      </div>`
      })
      .join('\n')

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paparazzo Daily Report - ${dateStr}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f4f9; padding: 20px; }
        h2 { border-bottom: 2px solid #007bff; padding-bottom: 5px; margin-top: 30px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 15px; display: flex; flex-direction: column; }
        .card h3 { margin-top: 0; font-size: 1.2rem; }
        .card-body { display: flex; gap: 12px; }
        .card-image { flex: 0 0 50%; }
        .card-image img { width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; }
        .card a { color: #007bff; text-decoration: none; }
        .card a:hover { text-decoration: underline; }
        .extracted-text { flex: 1; max-height: 500px; font-size: 0.85rem; background: #f8f8f8; padding: 10px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>News Report: ${dateStr}</h1>
    ${sectionsHtml}
</body>
</html>`

    await this.#fileStore.writeFile(`${dateStr}/index.html`, html)
  }
}
