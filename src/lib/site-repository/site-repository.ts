export type Site = {
  slug: string
  name: string
  description: string | null
  country: string
  version: 'original' | 'english'
  url: string
  enabled: boolean
}

export interface SiteRepository {
  findEnabled(): Promise<Site[]>
}
