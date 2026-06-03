import { createHttpClient } from '@eous/api-client-http'
import type { ApiClient } from '@eous/api-client-http'

export { ApiError } from '@eous/api-client-http'

export const api: ApiClient = createHttpClient({
  baseURL: '/api',
  credentials: 'include',
  onUnauthorized: () => {
    window.location.href = '/login'
  },
})
