import type { WebFetchUrlInput } from './schemas.js'

export interface WebFetchResult {
  url: string
  finalUrl?: string
  title?: string | null
  contentType?: string | null
  text: string
  truncated: boolean
  fetchedAt: string
}

export interface WebFetchSkillDeps {
  fetchUrl(input: WebFetchUrlInput): Promise<WebFetchResult>
}
