import { extname } from 'node:path'
import { AppError } from '../../lib/app-error.js'

export interface ParsedDocumentSection {
  index: number
  title: string | null
  sectionPath: string[]
  charCount: number
  tokenCount: number
}

export interface ParsedDocumentPreview {
  content: string
  mimeType: string | null
  fileName: string | null
  charCount: number
  tokenCount: number
  sections: ParsedDocumentSection[]
  warnings: string[]
}

function estimateTokenCount(text: string): number {
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const words = text
    .replace(/[\u3400-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(cjkChars * 0.7 + words * 1.3))
}

function normalizeText(buffer: Buffer): string {
  return buffer
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim()
}

function isPlainTextDocument(fileName: string | null, mimeType: string | null): boolean {
  const normalizedMime = mimeType?.toLowerCase() ?? ''
  const extension = fileName ? extname(fileName).toLowerCase() : ''

  return (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/x-markdown' ||
    ['.txt', '.md', '.markdown'].includes(extension)
  )
}

function splitMarkdownSections(content: string): ParsedDocumentSection[] {
  const lines = content.split('\n')
  const sections: ParsedDocumentSection[] = []
  const headingStack: string[] = []
  let currentLines: string[] = []
  let currentPath: string[] = []
  let currentTitle: string | null = null

  function flush() {
    const text = currentLines.join('\n').trim()
    if (!text) return
    sections.push({
      index: sections.length,
      title: currentTitle,
      sectionPath: currentPath,
      charCount: text.length,
      tokenCount: estimateTokenCount(text),
    })
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (match) {
      flush()
      const level = match[1].length
      const title = match[2].trim()
      headingStack.splice(level - 1)
      headingStack[level - 1] = title
      currentPath = headingStack.filter(Boolean)
      currentTitle = title
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }

  flush()

  if (sections.length > 0) return sections
  return [
    {
      index: 0,
      title: null,
      sectionPath: [],
      charCount: content.length,
      tokenCount: estimateTokenCount(content),
    },
  ]
}

export function parseDocumentPreview(input: {
  buffer: Buffer
  fileName: string | null
  mimeType: string | null
}): ParsedDocumentPreview {
  if (!isPlainTextDocument(input.fileName, input.mimeType)) {
    throw new AppError(
      'Only TXT and Markdown parsing preview is supported right now. PDF, DOCX, and EPUB upload is stored but parsing preview is not enabled yet.',
      400,
    )
  }

  const content = normalizeText(input.buffer)
  if (!content) throw new AppError('Parsed document content is empty', 400)

  const warnings: string[] = []
  if (content.length > 500_000) {
    warnings.push('Large document preview may be slow. Consider using wider chunks.')
  }

  return {
    content,
    mimeType: input.mimeType,
    fileName: input.fileName,
    charCount: content.length,
    tokenCount: estimateTokenCount(content),
    sections: splitMarkdownSections(content),
    warnings,
  }
}
