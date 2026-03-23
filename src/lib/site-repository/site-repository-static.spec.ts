import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Site } from './site-repository.ts'
import { SiteRepositoryStatic } from './site-repository-static.ts'

const makeSite = (overrides: Partial<Site> = {}): Site => ({
  slug: 'test-site',
  name: 'Test',
  description: null,
  country: 'Testland',
  version: 'original',
  url: 'https://test.com',
  enabled: true,
  ...overrides,
})

describe('SiteRepositoryStatic', () => {
  describe('findEnabled', () => {
    it('returns only enabled sites', async () => {
      const sites = [makeSite({ slug: 'a', enabled: true }), makeSite({ slug: 'b', enabled: false })]
      const repo = new SiteRepositoryStatic(sites)

      const result = await repo.findEnabled()

      assert.equal(result.length, 1)
      assert.equal(result[0].slug, 'a')
    })

    it('excludes disabled sites', async () => {
      const sites = [makeSite({ slug: 'a', enabled: false }), makeSite({ slug: 'b', enabled: true })]
      const repo = new SiteRepositoryStatic(sites)

      const result = await repo.findEnabled()

      assert.equal(
        result.every((s) => s.enabled),
        true,
      )
    })

    it('returns empty array when no sites are enabled', async () => {
      const sites = [makeSite({ enabled: false })]
      const repo = new SiteRepositoryStatic(sites)

      const result = await repo.findEnabled()

      assert.deepEqual(result, [])
    })
  })
})
