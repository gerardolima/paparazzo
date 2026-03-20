import type { Storage } from './storage/storage.ts'

export class ReportGenerator {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  async generate(dateStr: string): Promise<void> {
    const files = await this.storage.listEntries(dateStr)
    const screenshots = files.filter((f) => f.endsWith('.png'))

    const cardsHtml = screenshots
      .map((screenshot) => {
        const siteName = screenshot.replace('.png', '')
        const markdownFile = `${siteName}.md`
        const hasMarkdown = files.includes(markdownFile)

        return `
        <div class="card">
          <h2>${siteName}</h2>
          ${hasMarkdown ? `<p><a href="${markdownFile}">View Translated Text</a></p>` : ''}
          <a href="${screenshot}" target="_blank">
            <img src="${screenshot}" alt="${siteName} Screenshot">
          </a>
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
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 15px; display: flex; flex-direction: column; }
        .card h2 { margin-top: 0; font-size: 1.2rem; text-transform: capitalize; }
        .card img { width: 100%; height: auto; border-radius: 4px; border: 1px solid #ddd; cursor: pointer; }
        .card a { color: #007bff; text-decoration: none; margin-top: 10px; font-weight: bold; }
        .card a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <h1>News Report: ${dateStr}</h1>
    <div class="grid">
        ${cardsHtml}
    </div>
</body>
</html>`

    await this.storage.saveText(`${dateStr}/index.html`, html)
  }
}
