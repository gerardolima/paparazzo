import fs from 'node:fs/promises'
import nodePath from 'node:path'
import type { FileStore, ReaddirType } from './file-store.ts'

export class FileStoreLocal implements FileStore {
  readonly #baseDir: string

  constructor(baseDir = 'out/media') {
    this.#baseDir = baseDir
  }

  async #ensureDir(path: string): Promise<void> {
    const dir = nodePath.dirname(nodePath.join(this.#baseDir, path))
    await fs.mkdir(dir, { recursive: true })
  }

  async writeFile(path: string, data: Buffer | string): Promise<void> {
    await this.#ensureDir(path)
    const fullPath = nodePath.join(this.#baseDir, path)
    if (typeof data === 'string') {
      await fs.writeFile(fullPath, data, { encoding: 'utf-8' })
    } else {
      await fs.writeFile(fullPath, data)
    }
  }

  async readFile(path: string): Promise<string> {
    return fs.readFile(nodePath.join(this.#baseDir, path), { encoding: 'utf-8' })
  }

  async readdir(path: string, type: ReaddirType = 'file'): Promise<string[]> {
    return type === 'directory' ? this.#readdirDirs(path) : this.#readdirFiles(path)
  }

  async #readdirFiles(path: string): Promise<string[]> {
    const dir = nodePath.join(this.#baseDir, path)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries.filter((e) => e.isFile()).map((e) => e.name)
    } catch {
      return []
    }
  }

  async #readdirDirs(path: string): Promise<string[]> {
    const dir = nodePath.join(this.#baseDir, path)
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  }
}
