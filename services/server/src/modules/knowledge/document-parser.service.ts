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

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

function getDocumentExtension(fileName: string | null): string {
  return fileName ? extname(fileName).toLowerCase() : ''
}

function isPlainTextDocument(fileName: string | null, mimeType: string | null): boolean {
  const normalizedMime = mimeType?.toLowerCase() ?? ''
  const extension = getDocumentExtension(fileName)

  return (
    normalizedMime.startsWith('text/') ||
    normalizedMime === 'application/x-markdown' ||
    ['.txt', '.md', '.markdown'].includes(extension)
  )
}

function isPdfDocument(fileName: string | null, mimeType: string | null): boolean {
  return mimeType?.toLowerCase() === 'application/pdf' || getDocumentExtension(fileName) === '.pdf'
}

function isDocxDocument(fileName: string | null, mimeType: string | null): boolean {
  const normalizedMime = mimeType?.toLowerCase() ?? ''
  return (
    normalizedMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    getDocumentExtension(fileName) === '.docx'
  )
}

function isEpubDocument(fileName: string | null, mimeType: string | null): boolean {
  const normalizedMime = mimeType?.toLowerCase() ?? ''
  return normalizedMime === 'application/epub+zip' || getDocumentExtension(fileName) === '.epub'
}

type DynamicModule = Record<string, unknown>

async function importOptional(moduleName: string): Promise<DynamicModule> {
  try {
    const loader = new Function('moduleName', 'return import(moduleName)') as (
      moduleName: string,
    ) => Promise<DynamicModule>
    return await loader(moduleName)
  } catch (error) {
    throw new AppError(
      `Document parser dependency "${moduleName}" is not installed. Install it before parsing this file type.`,
      500,
    )
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object') return value as Record<string, unknown>
  return null
}

function extractTextFromUnknownResult(result: unknown): string | null {
  if (typeof result === 'string') return result
  const record = asRecord(result)
  if (!record) return null

  for (const key of ['text', 'content', 'markdown', 'pageContent', 'rawText']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value
  }

  for (const key of ['pages', 'documents', 'docs']) {
    const value = record[key]
    if (!Array.isArray(value)) continue
    const parts = value
      .map((item) => extractTextFromUnknownResult(item))
      .filter((item): item is string => Boolean(item?.trim()))
    if (parts.length > 0) return parts.join('\n\n')
  }

  return null
}

async function parsePdfText(buffer: Buffer): Promise<{ content: string; warnings: string[] }> {
  const module = await importOptional('opendataloader-pdf')
  const candidate =
    module.parsePdf ??
    module.parsePDF ??
    module.loadPdf ??
    module.loadPDF ??
    module.openDataLoaderPdf ??
    module.default

  if (typeof candidate !== 'function') {
    throw new AppError(
      'opendataloader-pdf is installed, but no supported PDF parser export was found.',
      500,
    )
  }

  const result = await candidate(buffer)
  const content = normalizeExtractedText(extractTextFromUnknownResult(result) ?? '')
  if (!content) {
    throw new AppError(
      'Parsed PDF content is empty. This may be a scanned PDF; OCR is not enabled yet.',
      400,
    )
  }

  return {
    content,
    warnings: [
      'PDF parsing extracts text only. Scanned PDFs require OCR, which is not enabled yet.',
    ],
  }
}

async function parseDocxText(buffer: Buffer): Promise<{ content: string; warnings: string[] }> {
  const module = await importOptional('mammoth')
  const mammoth = asRecord(module.default) ?? module
  const extractRawText = mammoth.extractRawText
  if (typeof extractRawText !== 'function') {
    throw new AppError('mammoth is installed, but extractRawText is not available.', 500)
  }

  const result = await extractRawText({ buffer })
  const content = normalizeExtractedText(extractTextFromUnknownResult(result) ?? '')
  if (!content) throw new AppError('Parsed DOCX content is empty', 400)

  return {
    content,
    warnings: [
      'DOCX parsing extracts raw text; complex formatting, tables, and images are not preserved.',
    ],
  }
}

function firstArrayItem<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value
}

function dirname(path: string): string {
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index + 1)
}

function joinZipPath(basePath: string, itemPath: string): string {
  if (!basePath || itemPath.startsWith('/')) return itemPath.replace(/^\/+/, '')
  return `${basePath}${itemPath}`.replace(/\/{2,}/g, '/')
}

function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  }
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase()
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16))
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10))
    }
    return entities[normalized] ?? match
  })
}

function htmlToText(html: string): string {
  return normalizeExtractedText(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<\/(p|div|section|article|h[1-6]|li|tr)>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/[ \t]{2,}/g, ' '),
    ),
  )
}

async function parseEpubText(buffer: Buffer): Promise<{ content: string; warnings: string[] }> {
  const jszipModule = await importOptional('jszip')
  const parserModule = await importOptional('fast-xml-parser')
  const JSZipValue = jszipModule.default
  const XMLParserValue = parserModule.XMLParser
  if (typeof JSZipValue !== 'function' || typeof XMLParserValue !== 'function') {
    throw new AppError(
      'EPUB parser dependencies are installed, but their exports are invalid.',
      500,
    )
  }

  const JSZip = JSZipValue as unknown as {
    loadAsync(buffer: Buffer): Promise<{
      file(path: string): { async(type: 'string'): Promise<string> } | null
    }>
  }
  const XMLParser = XMLParserValue as new (options: {
    ignoreAttributes: boolean
    attributeNamePrefix: string
  }) => {
    parse(xml: string): Record<string, unknown>
  }

  const zip = await JSZip.loadAsync(buffer)
  const containerXml = await zip.file('META-INF/container.xml')?.async('string')
  if (!containerXml) throw new AppError('EPUB container.xml is missing', 400)

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const container = parser.parse(containerXml)
  const rootfile = firstArrayItem(
    asRecord(asRecord(asRecord(container)?.container)?.rootfiles)?.rootfile as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  )
  const opfPath = typeof rootfile?.['@_full-path'] === 'string' ? rootfile['@_full-path'] : null
  if (!opfPath) throw new AppError('EPUB OPF package path is missing', 400)

  const opfXml = await zip.file(opfPath)?.async('string')
  if (!opfXml) throw new AppError('EPUB OPF package file is missing', 400)

  const opf = parser.parse(opfXml)
  const packageRecord = asRecord(opf.package)
  const manifestItems = asRecord(packageRecord?.manifest)?.item
  const spineItems = asRecord(packageRecord?.spine)?.itemref
  const manifest = (Array.isArray(manifestItems) ? manifestItems : [manifestItems]).filter(
    Boolean,
  ) as Record<string, unknown>[]
  const spine = (Array.isArray(spineItems) ? spineItems : [spineItems]).filter(Boolean) as Record<
    string,
    unknown
  >[]

  const manifestById = new Map(
    manifest
      .filter((item) => typeof item['@_id'] === 'string')
      .map((item) => [item['@_id'] as string, item]),
  )
  const opfDir = dirname(opfPath)
  const parts: string[] = []

  for (const itemRef of spine) {
    const idRef = itemRef['@_idref']
    if (typeof idRef !== 'string') continue
    const item = manifestById.get(idRef)
    const href = item?.['@_href']
    if (typeof href !== 'string') continue
    const mediaType = typeof item?.['@_media-type'] === 'string' ? item['@_media-type'] : ''
    if (!mediaType.includes('html') && !href.match(/\.(xhtml|html?)$/i)) continue
    const html = await zip.file(joinZipPath(opfDir, href))?.async('string')
    if (!html) continue
    const text = htmlToText(html)
    if (text) parts.push(text)
  }

  const content = normalizeExtractedText(parts.join('\n\n'))
  if (!content) throw new AppError('Parsed EPUB content is empty', 400)

  return {
    content,
    warnings: [
      'EPUB parsing follows the spine order and extracts readable text from HTML chapters.',
    ],
  }
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

export async function parseDocumentPreview(input: {
  buffer: Buffer
  fileName: string | null
  mimeType: string | null
}): Promise<ParsedDocumentPreview> {
  const warnings: string[] = []
  let content = ''

  if (isPlainTextDocument(input.fileName, input.mimeType)) {
    content = normalizeText(input.buffer)
  } else if (isPdfDocument(input.fileName, input.mimeType)) {
    const parsed = await parsePdfText(input.buffer)
    content = parsed.content
    warnings.push(...parsed.warnings)
  } else if (isDocxDocument(input.fileName, input.mimeType)) {
    const parsed = await parseDocxText(input.buffer)
    content = parsed.content
    warnings.push(...parsed.warnings)
  } else if (isEpubDocument(input.fileName, input.mimeType)) {
    const parsed = await parseEpubText(input.buffer)
    content = parsed.content
    warnings.push(...parsed.warnings)
  } else {
    throw new AppError(
      'Unsupported document type. Supported types are TXT, Markdown, PDF, DOCX, and EPUB.',
      400,
    )
  }

  if (!content) throw new AppError('Parsed document content is empty', 400)

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
