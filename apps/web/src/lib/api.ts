import { createHttpClient } from '@eous/api-client-http'
import type { ApiClient } from '@eous/api-client-http'

export { ApiError } from '@eous/api-client-http'

export const api: ApiClient = createHttpClient({
  baseURL: '/api',
  credentials: 'include',
  onUnauthorized: () => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
  },
})
