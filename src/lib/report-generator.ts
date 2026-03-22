import type { Site } from './data/sites.ts'
import type { Storage } from './storage/storage.ts'

export class ReportGenerator {
  readonly #storage: Storage

  constructor(storage: Storage) {
    this.#storage = storage
  }

  async generate(dateStr: string, sites: Site[]): Promise<void> {
    const files = await this.#storage.listEntries(dateStr)
    const screenshots = files.filter((f) => f.endsWith('.png'))

    const slugToSite = new Map<string, Site>()
    for (const site of sites) {
      slugToSite.set(site.slug, site)
    }

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
            const markdownFile = `${slug}.md`
            const hasMarkdown = files.includes(markdownFile)

            const name = site?.name ?? slug
            const description = site?.description

            return `
        <div class="card">
          <h3>${name}</h3>
          ${description ? `<p class="description">${description}</p>` : ''}
          ${hasMarkdown ? `<p><a href="${markdownFile}">View Translated Text</a></p>` : ''}
          <a href="${screenshot}" target="_blank">
            <img src="${screenshot}" alt="${name} Screenshot">
          </a>
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
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 15px; display: flex; flex-direction: column; }
        .card h3 { margin-top: 0; font-size: 1.2rem; }
        .card .description { color: #666; font-size: 0.9rem; margin: 0 0 10px; }
        .card img { width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; }
        .card a { color: #007bff; text-decoration: none; margin-top: 10px; font-weight: bold; }
        .card a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>News Report: ${dateStr}</h1>
    ${sectionsHtml}
</body>
</html>`

    await this.#storage.saveText(`${dateStr}/index.html`, html)
  }
}
