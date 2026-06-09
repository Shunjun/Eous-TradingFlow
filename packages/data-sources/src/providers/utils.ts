export function isNetworkError(e: any): boolean {
  return (
    ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].includes(e?.code) ||
    e?.message?.includes('fetch failed') ||
    e?.message?.includes('socket hang up')
  )
}

export function isRateLimitError(e: any): boolean {
  return (
    e?.message?.toLowerCase().includes('rate limit') ||
    e?.message?.toLowerCase().includes('too many requests') ||
    e?.code === 'RateLimitExceeded'
  )
}
