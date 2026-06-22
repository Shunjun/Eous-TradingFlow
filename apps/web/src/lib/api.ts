import { createHttpClient, createMarketDataSocketClient } from '@eous/api-client'
import type { ApiClient } from '@eous/api-client'

export { ApiError } from '@eous/api-client'

export const api: ApiClient = createHttpClient({
  baseURL: '/api',
  credentials: 'include',
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
})

export const marketData = createMarketDataSocketClient()
