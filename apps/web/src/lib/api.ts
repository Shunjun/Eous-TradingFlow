import { createHttpClient, createMarketDataSocketClient } from '@eous/api-client'
import type { ApiClient } from '@eous/api-client'
import { toast } from '@eous/ui'

export { ApiError } from '@eous/api-client'

export const api: ApiClient = createHttpClient({
  baseURL: '/api',
  credentials: 'include',
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
  onError: (error) => {
    if (error.status === 401) return
    toast.error(error.message)
  },
})

export const marketData = createMarketDataSocketClient()
