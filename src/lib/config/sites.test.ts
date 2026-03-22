import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SITES, type Site, siteSlug } from './sites.ts'

describe('siteSlug', () => {
  it('lowercases the name and replaces non-alphanumeric chars with hyphens', () => {
    const site: Site = {
      name: 'AFP',
      description: null,
      country: 'França',
      version: 'original',
      url: 'http://www.afp.com',
      enabled: true,
    }

    assert.equal(siteSlug(site), 'afp')
  })

  it('appends -english suffix for english version', () => {
    const site: Site = {
      name: 'Agerpres',
      description: 'Agenția Națională de Presă',
      country: 'Roménia',
      version: 'english',
      url: 'https://agerpres.ro/english',
      enabled: true,
    }

    assert.equal(siteSlug(site), 'agerpres-english')
  })

  it('replaces spaces and special characters with hyphens', () => {
    const site: Site = {
      name: 'PA Media:Press Association',
      description: null,
      country: 'Reino Unido',
      version: 'original',
      url: 'https://pa.media/',
      enabled: true,
    }

    assert.equal(siteSlug(site), 'pa-media-press-association')
  })

  it('collapses consecutive non-alphanumeric chars into a single hyphen', () => {
    const site: Site = {
      name: 'ANAMPA / AMNA',
      description: 'AthensMacedonian News Agency',
      country: 'Grécia',
      version: 'english',
      url: 'https://www.amna.gr/en',
      enabled: true,
    }

    assert.equal(siteSlug(site), 'anampa-amna-english')
  })

  it('trims leading and trailing hyphens', () => {
    const site: Site = {
      name: 'ČTK',
      description: 'Czech News Agency',
      country: 'República Checa',
      version: 'original',
      url: 'https://www.ctk.cz/',
      enabled: true,
    }

    assert.equal(siteSlug(site), 'tk')
  })
})

describe('SITES', () => {
  it('excludes entries with null url', () => {
    const nullUrls = SITES.filter((s) => s.url === null)

    assert.equal(nullUrls.length, 0)
  })

  it('contains all entries with non-null url', () => {
    assert.equal(SITES.length, 51)
  })

  it('is sorted alphabetically by name', () => {
    const names = SITES.map((s) => s.name)
    const sorted = [...names].sort((a, b) => a.localeCompare(b))

    assert.deepEqual(names, sorted)
  })
})
