import type { WebFetchUrlInput } from '../schemas.js'
import type { WebFetchResult } from '../types.js'

const MAX_DOWNLOAD_BYTES = 1024 * 1024
const FETCH_TIMEOUT_MS = 12000

function assertFetchableUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs can be fetched')
  }
  return url
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
}

function extractTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return null
  return decodeHtmlEntities(match[1].replace(/\s+/g, ' ').trim())
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/(p|div|section|article|header|footer|main|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

async function readLimitedText(response: Response): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader()
  if (!reader) return { text: await response.text(), truncated: false }

  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue

    const remaining = MAX_DOWNLOAD_BYTES - total
    if (remaining <= 0) {
      truncated = true
      break
    }

    chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value)
    total += Math.min(value.byteLength, remaining)
    if (value.byteLength > remaining) {
      truncated = true
      break
    }
  }

  if (truncated) await reader.cancel().catch(() => undefined)

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return { text: new TextDecoder().decode(merged), truncated }
}

export async function fetchUrl(input: WebFetchUrlInput): Promise<WebFetchResult> {
  const url = assertFetchableUrl(input.url)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        Accept: 'text/html, text/plain, application/xhtml+xml;q=0.9, */*;q=0.1',
        'User-Agent': 'EousTradingFlow-Agent/1.0',
      },
    })

    if (!response.ok) throw new Error(`Fetch failed with HTTP ${response.status}`)

    const contentType = response.headers.get('content-type')
    const body = await readLimitedText(response)
    const title = contentType?.includes('html') ? extractTitle(body.text) : null
    const formatted = input.format === 'html' ? body.text : htmlToText(body.text)
    const text = formatted.slice(0, input.maxChars)

    return {
      url: input.url,
      finalUrl: response.url,
      title,
      contentType,
      text,
      truncated: body.truncated || formatted.length > input.maxChars,
      fetchedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}
