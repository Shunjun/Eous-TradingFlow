import { createHttpClient } from '@eous/api-client-http'
import type { ApiClient } from '@eous/api-client'

export function createElectronClient(port = 3001, devToken = 'dev-token'): ApiClient {
  return createHttpClient({
    baseURL: `http://localhost:${port}/api`,
    getToken: () => devToken,
  })
}
