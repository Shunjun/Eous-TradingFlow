import { describe, expect, it } from 'vitest'
import { AppError } from '../../lib/app-error.js'
import { previewChunks } from './chunking.service.js'

describe('knowledge chunking service', () => {
  it('previews markdown chunks with section metadata', () => {
    const preview = previewChunks({
      content: '# Chapter 1\n\nAlpha beta gamma.\n\n## Section A\n\nDelta epsilon zeta.',
      config: { granularity: 20, overlap: 'none' },
    })

    expect(preview.chunks.length).toBeGreaterThan(0)
    expect(preview.chunks[0]?.metadata.sectionPath).toEqual(['Chapter 1'])
    expect(preview.chunks.at(-1)?.metadata.sectionPath).toEqual(['Chapter 1', 'Section A'])
    expect(preview.stats.chunkCount).toBe(preview.chunks.length)
  })

  it('rejects semantic chunking until embedding-backed splitting is enabled', () => {
    expect(() =>
      previewChunks({
        content: 'Alpha beta gamma.',
        config: { strategy: 'semantic' },
      }),
    ).toThrow(AppError)
  })
})
