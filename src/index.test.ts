import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { describe, it } from 'node:test'

describe('index', () => {
  it('returns Hello World', () => {
    const result = execSync('node src/index.ts', { encoding: 'utf-8' })
    assert.equal(result.trim(), 'Hello World')
  })
})
