import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { FileStoreLocal } from './file-store-local.ts'

describe('FileStoreLocal', () => {
  const testDir = 'test-output'
  const store = new FileStoreLocal(testDir)

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('saves a screenshot successfully', async () => {
    const filename = 'test-image.png'
    const data = Buffer.from('mock image data')

    await store.writeFile(filename, data)

    const savedData = await fs.readFile(path.join(testDir, filename))
    assert.deepEqual(savedData, data)
  })

  it('saves text successfully', async () => {
    const filename = 'test-doc.md'
    const content = '# Hello World'

    await store.writeFile(filename, content)

    const savedContent = await fs.readFile(path.join(testDir, filename), { encoding: 'utf-8' })
    assert.equal(savedContent, content)
  })

  it('creates nested directories if they do not exist', async () => {
    const filename = 'deep/nested/dir/test.txt'
    const content = 'nested'

    await store.writeFile(filename, content)

    const savedContent = await fs.readFile(path.join(testDir, filename), { encoding: 'utf-8' })
    assert.equal(savedContent, content)
  })

  it('reads text content from a saved file', async () => {
    const filename = 'read-test/doc.md'
    const content = '<h2>Headlines</h2><p>Some news</p>'

    await store.writeFile(filename, content)
    const result = await store.readFile(filename)

    assert.equal(result, content)
  })

  it('lists entries in a directory', async () => {
    const dateDir = '2024-01-01'
    await store.writeFile(`${dateDir}/a.md`, 'content')
    await store.writeFile(`${dateDir}/b.png`, Buffer.from('data'))

    const entries = await store.readdir(dateDir)
    assert.deepEqual(entries.sort(), ['a.md', 'b.png'])
  })

  it('lists subdirectories', async () => {
    await store.writeFile('2024-01-01/a.png', Buffer.from('data'))
    await store.writeFile('2024-06-15/b.png', Buffer.from('data'))

    const dirs = await store.readdir('', 'directory')

    assert.ok(dirs.includes('2024-01-01'))
    assert.ok(dirs.includes('2024-06-15'))
  })

  it('returns empty array when directory does not exist for listSubdirs', async () => {
    const emptyStore = new FileStoreLocal('nonexistent-dir')

    const dirs = await emptyStore.readdir('', 'directory')

    assert.deepEqual(dirs, [])
  })
})
