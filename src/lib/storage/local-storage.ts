import fs from 'node:fs/promises'
import path from 'node:path'
import type { Storage } from './storage.ts'

export class LocalStorage implements Storage {
  readonly #baseDir: string

  constructor(baseDir = 'out/media') {
    this.#baseDir = baseDir
  }

  async #ensureDir(filename: string): Promise<void> {
    const dir = path.dirname(path.join(this.#baseDir, filename))
    await fs.mkdir(dir, { recursive: true })
  }

  async saveScreenshot(filename: string, data: Buffer): Promise<void> {
    await this.#ensureDir(filename)
    await fs.writeFile(path.join(this.#baseDir, filename), data)
  }

  async saveText(filename: string, content: string): Promise<void> {
    await this.#ensureDir(filename)
    await fs.writeFile(path.join(this.#baseDir, filename), content, { encoding: 'utf-8' })
  }

  async readText(filename: string): Promise<string> {
    return fs.readFile(path.join(this.#baseDir, filename), { encoding: 'utf-8' })
  }

  async listEntries(dateStr: string): Promise<string[]> {
    const dir = path.join(this.#baseDir, dateStr)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch {
      return []
    }
  }
}
