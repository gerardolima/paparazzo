import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { LocalStorage } from './local-storage.ts'

describe('LocalStorage', () => {
  const testDir = 'test-output'
  const adapter = new LocalStorage(testDir)

  before(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  after(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('saves a screenshot successfully', async () => {
    const filename = 'test-image.png'
    const data = Buffer.from('mock image data')

    await adapter.saveScreenshot(filename, data)

    const savedData = await fs.readFile(path.join(testDir, filename))
    assert.deepEqual(savedData, data)
  })

  it('saves text successfully', async () => {
    const filename = 'test-doc.md'
    const content = '# Hello World'

    await adapter.saveText(filename, content)

    const savedContent = await fs.readFile(path.join(testDir, filename), { encoding: 'utf-8' })
    assert.equal(savedContent, content)
  })

  it('creates nested directories if they do not exist', async () => {
    const filename = 'deep/nested/dir/test.txt'
    const content = 'nested'

    await adapter.saveText(filename, content)

    const savedContent = await fs.readFile(path.join(testDir, filename), { encoding: 'utf-8' })
    assert.equal(savedContent, content)
  })
})
