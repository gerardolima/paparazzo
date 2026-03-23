import type { Site, SiteRepository } from './site-repository.ts'

export class SiteRepositoryStatic implements SiteRepository {
  readonly #sites: Site[]

  constructor(sites: Site[]) {
    this.#sites = sites
  }

  async findEnabled(): Promise<Site[]> {
    return this.#sites.filter((s) => s.enabled)
  }
}
