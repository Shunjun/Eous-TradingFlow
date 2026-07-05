import { describe, expect, it } from 'vitest'
import { AppError } from '../../lib/app-error.js'
import { parseDocumentPreview } from './document-parser.service.js'

describe('knowledge document parser service', () => {
  it('parses markdown text and extracts heading sections', async () => {
    const preview = await parseDocumentPreview({
      buffer: Buffer.from('# Chapter 1\n\nAlpha beta.\n\n## Section A\n\nDelta epsilon.'),
      fileName: 'book.md',
      mimeType: 'text/markdown',
    })

    expect(preview.fileName).toBe('book.md')
    expect(preview.content).toContain('Chapter 1')
    expect(preview.sections).toHaveLength(2)
    expect(preview.sections[0]?.sectionPath).toEqual(['Chapter 1'])
    expect(preview.sections[1]?.sectionPath).toEqual(['Chapter 1', 'Section A'])
  })

  it('rejects unsupported binary document previews', async () => {
    await expect(
      parseDocumentPreview({
        buffer: Buffer.from('binary'),
        fileName: 'book.bin',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toThrow(AppError)
  })
})
