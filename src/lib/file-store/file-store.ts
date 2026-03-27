/**
 * A generic file-persistence adapter modelled after node:fs/promises.
 * Implementations may target the local filesystem, S3, or any other backend.
 */
export type ReaddirType = 'file' | 'directory'

export interface FileStore {
  writeFile(path: string, data: Buffer | string): Promise<void>
  readFile(path: string): Promise<string>
  readdir(path: string, type?: ReaddirType): Promise<string[]>
}
