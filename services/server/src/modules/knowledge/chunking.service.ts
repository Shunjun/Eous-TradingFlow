import { SentenceSplitter } from 'llamaindex/node-parser'
import { AppError } from '../../lib/app-error.js'

export type ChunkingStrategy = 'auto_structure' | 'semantic'
export type ChunkingOverlap = 'none' | 'low' | 'standard' | 'high'
export type ChunkBoundaryPreference = 'auto' | 'heading' | 'paragraph' | 'semantic'

export interface ChunkingConfig {
  strategy?: ChunkingStrategy
  granularity?: number
  overlap?: ChunkingOverlap
  boundaryPreference?: ChunkBoundaryPreference
  maxChunks?: number
}

export interface ChunkPreviewInput {
  content: string
  config?: ChunkingConfig
}

export interface ChunkPreviewItem {
  index: number
  content: string
  tokenCount: number
  charCount: number
  metadata: {
    sectionPath: string[]
    source: 'raw'
  }
}

export interface ChunkPreviewResult {
  chunks: ChunkPreviewItem[]
  config: Required<ChunkingConfig>
  stats: {
    chunkCount: number
    tokenCount: number
    charCount: number
  }
}

const DEFAULT_CONFIG: Required<ChunkingConfig> = {
  strategy: 'auto_structure',
  granularity: 50,
  overlap: 'standard',
  boundaryPreference: 'auto',
  maxChunks: 500,
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function estimateTokenCount(text: string): number {
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const words = text
    .replace(/[\u3400-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(cjkChars * 0.7 + words * 1.3))
}

function normalizeConfig(config?: ChunkingConfig): Required<ChunkingConfig> {
  return {
    strategy: config?.strategy ?? DEFAULT_CONFIG.strategy,
    granularity: clamp(config?.granularity ?? DEFAULT_CONFIG.granularity, 0, 100),
    overlap: config?.overlap ?? DEFAULT_CONFIG.overlap,
    boundaryPreference: config?.boundaryPreference ?? DEFAULT_CONFIG.boundaryPreference,
    maxChunks: clamp(config?.maxChunks ?? DEFAULT_CONFIG.maxChunks, 1, 2000),
  }
}

function chunkSizeFromGranularity(granularity: number): number {
  if (granularity >= 90) return 2200
  if (granularity >= 70) return 1500
  if (granularity >= 40) return 1000
  if (granularity >= 20) return 650
  return 400
}

function overlapTokens(chunkSize: number, overlap: ChunkingOverlap): number {
  if (overlap === 'none') return 0
  if (overlap === 'low') return Math.floor(chunkSize * 0.08)
  if (overlap === 'high') return Math.floor(chunkSize * 0.2)
  return Math.floor(chunkSize * 0.14)
}

function splitMarkdownSections(content: string): Array<{ sectionPath: string[]; content: string }> {
  const lines = content.split(/\r?\n/)
  const sections: Array<{ sectionPath: string[]; content: string }> = []
  const headingStack: string[] = []
  let currentLines: string[] = []
  let currentPath: string[] = []

  function flush() {
    const text = currentLines.join('\n').trim()
    if (!text) return
    sections.push({ sectionPath: currentPath, content: text })
  }

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/)
    if (match) {
      flush()
      const level = match[1].length
      headingStack.splice(level - 1)
      headingStack[level - 1] = match[2].trim()
      currentPath = headingStack.filter(Boolean)
      currentLines = [line]
    } else {
      currentLines.push(line)
    }
  }

  flush()
  return sections.length ? sections : [{ sectionPath: [], content }]
}

function createSentenceSplitter(config: Required<ChunkingConfig>): SentenceSplitter {
  const chunkSize = chunkSizeFromGranularity(config.granularity)
  return new SentenceSplitter({
    chunkSize,
    chunkOverlap: overlapTokens(chunkSize, config.overlap),
    paragraphSeparator: '\n\n',
  })
}

export function previewChunks(input: ChunkPreviewInput): ChunkPreviewResult {
  const content = input.content.trim()
  if (!content) throw new AppError('Content is required for chunk preview', 400)

  const config = normalizeConfig(input.config)
  if (config.strategy === 'semantic') {
    throw new AppError('Semantic chunking is not enabled yet', 400)
  }

  const splitter = createSentenceSplitter(config)
  const chunks: ChunkPreviewItem[] = []
  const sections = splitMarkdownSections(content)

  for (const section of sections) {
    const splits = splitter.splitText(section.content)
    for (const split of splits) {
      const trimmed = split.trim()
      if (!trimmed) continue
      if (chunks.length >= config.maxChunks) {
        throw new AppError(`Chunk preview exceeds maxChunks (${config.maxChunks})`, 400)
      }
      chunks.push({
        index: chunks.length,
        content: trimmed,
        tokenCount: estimateTokenCount(trimmed),
        charCount: trimmed.length,
        metadata: {
          sectionPath: section.sectionPath,
          source: 'raw',
        },
      })
    }
  }

  return {
    chunks,
    config,
    stats: {
      chunkCount: chunks.length,
      tokenCount: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      charCount: chunks.reduce((sum, chunk) => sum + chunk.charCount, 0),
    },
  }
}
