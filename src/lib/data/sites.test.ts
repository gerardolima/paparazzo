import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SITES } from './sites.ts'

describe('SITES', () => {
  it('excludes entries with null url', () => {
    const nullUrls = SITES.filter((s) => s.url === null)

    assert.equal(nullUrls.length, 0)
  })

  it('contains all entries with non-null url', () => {
    assert.equal(SITES.length, 51)
  })

  it('is sorted alphabetically by name', () => {
    const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const names = SITES.map((s) => strip(s.name))
    const sorted = [...names].sort((a, b) => a.localeCompare(b))

    assert.deepEqual(names, sorted)
  })
})
