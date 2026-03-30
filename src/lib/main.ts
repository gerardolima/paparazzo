import type { FileStore } from './file-store/file-store.ts'
import type { AIClient } from './ia-client/ai-client.ts'
import { ReportGenerator } from './report-generator.ts'
import type { ScreenCapturer } from './screen-capturer.ts'
import type { Site } from './site-repository/site-repository.ts'

const MAX_RETRIES = 2

export type ProcessOptions = {
  sites: Site[]
  fileStore: FileStore
  aiClient: AIClient
  capturer: ScreenCapturer
  signal?: AbortSignal
}

export type ProcessResult = {
  dateStr: string
  processed: string[]
  failed: Array<{ site: string; error: string }>
  skipped: number
  total: number
  timedOut: boolean
}

export async function start(options: ProcessOptions): Promise<ProcessResult> {
  const { sites, fileStore, aiClient, capturer, signal } = options
  const dateStr = new Date().toISOString().split('T')[0]
  const generator = new ReportGenerator(fileStore)

  const processed: string[] = []
  const failed: Array<{ site: string; error: string }> = []
  let skipped = 0
  let timedOut = false
  const total = sites.length

  // Phase 1: Capture screenshots
  for (let i = 0; i < total; i++) {
    if (signal?.aborted) {
      console.warn(`Aborted — stopping capture after ${i} of ${total} sites`)
      timedOut = true
      break
    }

    const site = sites[i]
    const pngPath = `${dateStr}/${site.slug}.png`

    if (await fileStore.exists(pngPath)) {
      console.log(`${i + 1} / ${total} ${site.name} (${site.version}): screenshot exists, skipping`)
      continue
    }

    try {
      console.log(`${i + 1} / ${total} Capturing ${site.name} (${site.version})...`)
      const buffer = await capturer.capture(site)
      await fileStore.writeFile(pngPath, buffer)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to capture ${site.name} (${site.version}):`, error)
      failed.push({ site: `${site.name} (${site.version})`, error: message })
    }
  }

  // Phase 2: Extract text with queue-based retry
  type QueueItem = { site: Site; attempts: number }
  const queue: QueueItem[] = []

  for (const site of sites) {
    const pngPath = `${dateStr}/${site.slug}.png`
    const mdPath = `${dateStr}/${site.slug}.md`
    const pngExists = await fileStore.exists(pngPath)
    const mdExists = await fileStore.exists(mdPath)
    if (pngExists && mdExists) {
      skipped++
    } else if (pngExists) {
      queue.push({ site, attempts: 0 })
    }
  }

  while (queue.length > 0) {
    if (signal?.aborted) {
      console.warn(`Aborted — stopping extraction with ${queue.length} items remaining`)
      timedOut = true
      break
    }

    // biome-ignore lint/style/noNonNullAssertion: the queue is not empty
    const item = queue.shift()!
    try {
      console.log(`Extracting text for ${item.site.name} (${item.site.version})...`)
      const png = await fileStore.readFile(`${dateStr}/${item.site.slug}.png`)
      const md = await aiClient.getText(png, item.site.country)
      await fileStore.writeFile(`${dateStr}/${item.site.slug}.md`, md)
      processed.push(`${item.site.name} (${item.site.version})`)
    } catch (error) {
      if (item.attempts < MAX_RETRIES) {
        console.warn(
          `Extraction failed for ${item.site.name} (attempt ${item.attempts + 1}/${MAX_RETRIES + 1}), re-queueing`,
        )
        queue.push({ ...item, attempts: item.attempts + 1 })
      } else {
        const message = error instanceof Error ? error.message : String(error)
        console.error(
          `Failed to extract ${item.site.name} (${item.site.version}) after ${item.attempts + 1} attempts:`,
          error,
        )
        failed.push({ site: `${item.site.name} (${item.site.version})`, error: message })
      }
    }
  }

  console.log('Generating report...')
  await generator.generate(dateStr, sites)
  await generator.generateIndex()

  return { dateStr, processed, failed, skipped, total, timedOut }
}
