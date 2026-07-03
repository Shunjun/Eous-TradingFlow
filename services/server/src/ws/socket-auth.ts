import { SESSION_COOKIE, validateSession } from '../lib/auth-utils.js'

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {}

  const cookies: Record<string, string> = {}
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) cookies[key] = decodeURIComponent(value)
  }
  return cookies
}

export async function authenticateSocketCookie(header: string | undefined) {
  const token = parseCookies(header)[SESSION_COOKIE]
  if (!token) return null
  return validateSession(token)
}
