import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  KnowledgeBase,
  KnowledgeChunkPreviewItem,
  KnowledgeChunkingConfig,
  KnowledgeDocument,
  KnowledgeDocumentParsePreview,
} from '@eous/api-client'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Slider,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eous/ui'
import { ArrowLeft, Combine, FileText, Scissors, Upload } from 'lucide-react'
import { api } from '../../../../../lib/api'
import { useI18n } from '../../../../../lib/i18n'

type ImportStrategy = 'raw' | 'compressed' | 'hybrid'
type ImportStep = 'source' | 'chunking'
type LocalChunk = KnowledgeChunkPreviewItem

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function estimateTokenCount(text: string): number {
  const cjkChars = text.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const words = text
    .replace(/[\u3400-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
  return Math.max(1, Math.ceil(cjkChars * 0.7 + words * 1.3))
}

function reindexChunks(chunks: LocalChunk[]): LocalChunk[] {
  return chunks.map((chunk, index) => ({
    ...chunk,
    index,
    charCount: chunk.content.length,
    tokenCount: estimateTokenCount(chunk.content),
  }))
}

export default function KnowledgeImportPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [strategy, setStrategy] = useState<ImportStrategy>('raw')
  const [step, setStep] = useState<ImportStep>('source')
  const [document, setDocument] = useState<KnowledgeDocument | null>(null)
  const [parsePreview, setParsePreview] = useState<KnowledgeDocumentParsePreview | null>(null)
  const [chunks, setChunks] = useState<LocalChunk[]>([])
  const [chunking, setChunking] = useState(false)
  const [selectedChunkIndexes, setSelectedChunkIndexes] = useState<number[]>([])
  const [splitPosition, setSplitPosition] = useState(0)
  const [chunkConfig, setChunkConfig] = useState<KnowledgeChunkingConfig>({
    strategy: 'auto_structure',
    granularity: 50,
    overlap: 'standard',
    boundaryPreference: 'auto',
    maxChunks: 500,
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayTitle = useMemo(() => {
    const trimmedTitle = title.trim()
    if (trimmedTitle) return trimmedTitle
    return file?.name ?? t('knowledge.untitledDocument')
  }, [file?.name, title, t])
  const strategyLabel =
    strategy === 'compressed'
      ? t('knowledge.strategyCompressed')
      : strategy === 'hybrid'
        ? t('knowledge.strategyHybrid')
        : t('knowledge.strategyRaw')
  const selectedChunk =
    selectedChunkIndexes.length === 1 ? chunks[selectedChunkIndexes[0] ?? -1] : null
  const chunkStats = useMemo(
    () => ({
      chunkCount: chunks.length,
      tokenCount: chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0),
      charCount: chunks.reduce((sum, chunk) => sum + chunk.charCount, 0),
    }),
    [chunks],
  )

  useEffect(() => {
    if (!id) return

    setLoading(true)
    setError(null)
    void api
      .getKnowledgeBase(id)
      .then((res) => setKnowledgeBase(res.knowledgeBase))
      .catch((err) => {
        setError(err instanceof Error ? err.message : t('knowledge.failedToLoad'))
      })
      .finally(() => setLoading(false))
  }, [id, t])

  async function handleUploadDocument() {
    if (!id) return
    if (!file) {
      setError(t('knowledge.fileRequired'))
      return
    }

    setUploading(true)
    setError(null)
    try {
      const res = await api.uploadKnowledgeDocument(id, {
        file,
        title,
        strategy,
      })
      setDocument(res.document)
      await loadDocumentPreview(res.document.id)
      setStep('chunking')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToUploadDocument'))
    } finally {
      setUploading(false)
    }
  }

  async function loadDocumentPreview(documentId: string, nextConfig = chunkConfig) {
    setChunking(true)
    setError(null)
    try {
      const [parseResult, chunkResult] = await Promise.all([
        api.previewKnowledgeDocumentParse(documentId),
        api.previewKnowledgeDocumentChunks(documentId, { config: nextConfig }),
      ])
      setParsePreview(parseResult.preview)
      setChunks(chunkResult.preview.chunks)
      setSelectedChunkIndexes([])
      setSplitPosition(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToPreviewChunks'))
    } finally {
      setChunking(false)
    }
  }

  function updateChunkConfig(next: KnowledgeChunkingConfig) {
    setChunkConfig((current) => ({ ...current, ...next }))
  }

  function toggleSelectedChunk(index: number) {
    setSelectedChunkIndexes((current) => {
      const next = current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b)
      const firstSelected = next.length === 1 ? chunks[next[0] ?? -1] : null
      setSplitPosition(firstSelected ? Math.floor(firstSelected.content.length / 2) : 0)
      return next
    })
  }

  function mergeSelectedChunks() {
    if (selectedChunkIndexes.length < 2) return
    const sorted = [...selectedChunkIndexes].sort((a, b) => a - b)
    const isAdjacent = sorted.every((index, idx) => idx === 0 || index === sorted[idx - 1] + 1)
    if (!isAdjacent) {
      setError(t('knowledge.mergeAdjacentOnly'))
      return
    }

    const mergedContent = sorted.map((index) => chunks[index]?.content ?? '').join('\n\n')
    const first = chunks[sorted[0] ?? 0]
    if (!first) return

    const merged: LocalChunk = {
      ...first,
      content: mergedContent,
      charCount: mergedContent.length,
      tokenCount: estimateTokenCount(mergedContent),
    }
    const next = chunks.filter((_, index) => !sorted.includes(index))
    next.splice(sorted[0] ?? 0, 0, merged)
    setChunks(reindexChunks(next))
    setSelectedChunkIndexes([])
    setSplitPosition(0)
    setError(null)
  }

  function splitSelectedChunk() {
    if (!selectedChunk) return
    const position = Math.max(1, Math.min(splitPosition, selectedChunk.content.length - 1))
    const leftContent = selectedChunk.content.slice(0, position).trim()
    const rightContent = selectedChunk.content.slice(position).trim()
    if (!leftContent || !rightContent) {
      setError(t('knowledge.invalidSplitPosition'))
      return
    }

    const left: LocalChunk = {
      ...selectedChunk,
      content: leftContent,
      charCount: leftContent.length,
      tokenCount: estimateTokenCount(leftContent),
    }
    const right: LocalChunk = {
      ...selectedChunk,
      content: rightContent,
      charCount: rightContent.length,
      tokenCount: estimateTokenCount(rightContent),
    }
    const index = selectedChunk.index
    const next = [...chunks.slice(0, index), left, right, ...chunks.slice(index + 1)]
    setChunks(reindexChunks(next))
    setSelectedChunkIndexes([])
    setSplitPosition(0)
    setError(null)
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_34rem)] px-6 py-6">
      <div className="flex h-full flex-col gap-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="mb-3 w-fit px-0 text-muted-foreground"
            >
              <Link to="/knowledge">
                <ArrowLeft size={15} />
                {t('knowledge.backToKnowledge')}
              </Link>
            </Button>
            <p className="font-mono text-xs uppercase text-muted-foreground">
              {t('knowledge.importEyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              {knowledgeBase?.name ?? t('knowledge.importDocument')}
            </h1>
          </div>
        </header>

        <div className="grid min-h-[calc(100vh-13rem)] gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 rounded-lg border bg-card/80 p-4 shadow-sm backdrop-blur">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold">
                {step === 'source' ? t('knowledge.importDocument') : t('knowledge.chunkSettings')}
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {step === 'source'
                  ? loading
                    ? t('knowledge.loading')
                    : t('knowledge.importDocumentDescription').replace(
                        '{name}',
                        knowledgeBase?.name ?? '',
                      )
                  : t('knowledge.chunkSettingsDescription')}
              </p>
            </div>

            {step === 'source' ? (
              <>
                <div className="space-y-1.5">
                  <Label>{t('knowledge.documentTitle')}</Label>
                  <Input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder={t('knowledge.documentTitlePlaceholder')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t('knowledge.documentFile')}</Label>
                  <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition hover:bg-muted/40">
                    <Upload size={22} className="text-primary" />
                    <div className="mt-3 max-w-full truncate text-sm font-medium">
                      {file ? file.name : t('knowledge.selectDocumentFile')}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {file ? formatFileSize(file.size) : t('knowledge.documentFileHint')}
                    </div>
                    <Input
                      className="hidden"
                      type="file"
                      accept=".txt,.md,.markdown,.pdf,.docx,.epub,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] ?? null)
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('knowledge.importStrategy')}</Label>
                  <Select
                    value={strategy}
                    onValueChange={(value) => setStrategy(value as ImportStrategy)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="raw">{t('knowledge.strategyRaw')}</SelectItem>
                      <SelectItem value="compressed">
                        {t('knowledge.strategyCompressed')}
                      </SelectItem>
                      <SelectItem value="hybrid">{t('knowledge.strategyHybrid')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-md border border-border/70 bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('knowledge.currentDocument')}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {document?.title ?? displayTitle}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{strategyLabel}</div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>{t('knowledge.granularity')}</Label>
                    <span className="font-mono text-xs text-muted-foreground">
                      {chunkConfig.granularity ?? 50}
                    </span>
                  </div>
                  <Slider
                    value={[chunkConfig.granularity ?? 50]}
                    min={0}
                    max={100}
                    step={10}
                    onValueChange={([value]) => updateChunkConfig({ granularity: value })}
                  />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>{t('knowledge.finerChunks')}</span>
                    <span>{t('knowledge.widerChunks')}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('knowledge.overlap')}</Label>
                  <Select
                    value={chunkConfig.overlap ?? 'standard'}
                    onValueChange={(value) =>
                      updateChunkConfig({
                        overlap: value as NonNullable<KnowledgeChunkingConfig['overlap']>,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('knowledge.overlapNone')}</SelectItem>
                      <SelectItem value="low">{t('knowledge.overlapLow')}</SelectItem>
                      <SelectItem value="standard">{t('knowledge.overlapStandard')}</SelectItem>
                      <SelectItem value="high">{t('knowledge.overlapHigh')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>{t('knowledge.boundaryPreference')}</Label>
                  <Select
                    value={chunkConfig.boundaryPreference ?? 'auto'}
                    onValueChange={(value) =>
                      updateChunkConfig({
                        boundaryPreference: value as NonNullable<
                          KnowledgeChunkingConfig['boundaryPreference']
                        >,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">{t('knowledge.boundaryAuto')}</SelectItem>
                      <SelectItem value="heading">{t('knowledge.boundaryHeading')}</SelectItem>
                      <SelectItem value="paragraph">{t('knowledge.boundaryParagraph')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-md border border-border/70 bg-background/50 p-2">
                    <div className="text-[11px] text-muted-foreground">{t('knowledge.chunks')}</div>
                    <div className="font-mono text-lg font-semibold">{chunkStats.chunkCount}</div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-2">
                    <div className="text-[11px] text-muted-foreground">{t('knowledge.tokens')}</div>
                    <div className="font-mono text-lg font-semibold">{chunkStats.tokenCount}</div>
                  </div>
                  <div className="rounded-md border border-border/70 bg-background/50 p-2">
                    <div className="text-[11px] text-muted-foreground">
                      {t('knowledge.characters')}
                    </div>
                    <div className="font-mono text-lg font-semibold">{chunkStats.charCount}</div>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-auto flex gap-2">
              <Button variant="ghost" disabled={uploading} onClick={() => navigate('/knowledge')}>
                {t('settings.cancel')}
              </Button>
              {step === 'source' ? (
                <Button onClick={handleUploadDocument} disabled={uploading || !file || !id}>
                  <Upload size={14} />
                  {uploading ? t('knowledge.uploading') : t('knowledge.uploadDocument')}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={chunking || !document}
                    onClick={() => document && loadDocumentPreview(document.id)}
                  >
                    {chunking ? t('knowledge.previewing') : t('knowledge.recalculateChunks')}
                  </Button>
                  <Button onClick={() => id && navigate(`/knowledge/${id}`)}>
                    {t('knowledge.finishImport')}
                  </Button>
                </>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col rounded-lg border bg-card/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText size={16} className="text-primary" />
                <div className="truncate text-sm font-semibold">{displayTitle}</div>
              </div>
              <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                {strategyLabel}
              </span>
            </div>

            {step === 'source' && (
              <div className="grid gap-3 p-4 md:grid-cols-3">
                <div className="rounded-md border border-border/70 bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('knowledge.previewFileName')}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {file?.name ?? t('knowledge.noFileSelected')}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('knowledge.previewFileSize')}
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {file ? formatFileSize(file.size) : '-'}
                  </div>
                </div>
                <div className="rounded-md border border-border/70 bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">
                    {t('knowledge.previewFileType')}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">{file?.type || '-'}</div>
                </div>
              </div>
            )}

            {step === 'source' ? (
              <div className="flex flex-1 items-center justify-center border-t border-border p-8 text-center">
                <div className="max-w-md">
                  <FileText size={28} className="mx-auto text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">{t('knowledge.documentPreviewTitle')}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t('knowledge.documentPreviewDescription')}
                  </p>
                </div>
              </div>
            ) : (
              <Tabs defaultValue="chunks" className="min-h-0 flex-1 gap-0">
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <TabsList variant="line" className="h-9 justify-start">
                    <TabsTrigger value="chunks">{t('knowledge.rawChunks')}</TabsTrigger>
                    <TabsTrigger value="parsed">{t('knowledge.parsedDocument')}</TabsTrigger>
                    <TabsTrigger value="final">{t('knowledge.finalIndex')}</TabsTrigger>
                  </TabsList>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={selectedChunkIndexes.length < 2}
                      onClick={mergeSelectedChunks}
                    >
                      <Combine size={14} />
                      {t('knowledge.mergeChunks')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!selectedChunk}
                      onClick={splitSelectedChunk}
                    >
                      <Scissors size={14} />
                      {t('knowledge.splitChunk')}
                    </Button>
                  </div>
                </div>

                <TabsContent value="chunks" className="m-0 min-h-0 flex-1">
                  <div className="grid min-h-[520px] grid-cols-[minmax(0,1fr)_300px]">
                    <div className="min-h-0 overflow-auto">
                      {chunks.length === 0 ? (
                        <div className="p-6 text-sm text-muted-foreground">
                          {chunking ? t('knowledge.previewing') : t('knowledge.chunkPreviewEmpty')}
                        </div>
                      ) : (
                        <div className="divide-y">
                          {chunks.map((chunk) => {
                            const selected = selectedChunkIndexes.includes(chunk.index)
                            return (
                              <button
                                key={chunk.index}
                                type="button"
                                onClick={() => toggleSelectedChunk(chunk.index)}
                                className={
                                  'block w-full p-4 text-left transition hover:bg-muted/40 ' +
                                  (selected ? 'bg-muted/60' : '')
                                }
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-medium">
                                    {t('knowledge.chunkNumber').replace(
                                      '{number}',
                                      String(chunk.index + 1),
                                    )}
                                  </div>
                                  <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span>{chunk.tokenCount} tokens</span>
                                    <span>{chunk.charCount} chars</span>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {chunk.metadata.sectionPath.join(' / ') ||
                                    t('knowledge.noSection')}
                                </div>
                                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                  {chunk.content}
                                </p>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <aside className="border-l border-border p-4">
                      <div className="text-sm font-semibold">{t('knowledge.chunkTools')}</div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t('knowledge.chunkToolsDescription')}
                      </p>
                      <div className="mt-4 space-y-2">
                        <Label>{t('knowledge.splitPosition')}</Label>
                        <Input
                          type="number"
                          min={1}
                          max={Math.max(1, (selectedChunk?.content.length ?? 1) - 1)}
                          value={splitPosition}
                          disabled={!selectedChunk}
                          onChange={(event) => setSplitPosition(Number(event.target.value))}
                        />
                        <div className="text-xs text-muted-foreground">
                          {selectedChunk
                            ? t('knowledge.selectedChunkLength').replace(
                                '{count}',
                                String(selectedChunk.content.length),
                              )
                            : t('knowledge.selectOneChunkToSplit')}
                        </div>
                      </div>
                    </aside>
                  </div>
                </TabsContent>

                <TabsContent value="parsed" className="m-0 min-h-0 flex-1 overflow-auto p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-md border border-border/70 bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">{t('knowledge.tokens')}</div>
                      <div className="mt-1 font-mono text-lg font-semibold">
                        {parsePreview?.tokenCount ?? '-'}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">
                        {t('knowledge.characters')}
                      </div>
                      <div className="mt-1 font-mono text-lg font-semibold">
                        {parsePreview?.charCount ?? '-'}
                      </div>
                    </div>
                    <div className="rounded-md border border-border/70 bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">{t('knowledge.sections')}</div>
                      <div className="mt-1 font-mono text-lg font-semibold">
                        {parsePreview?.sections.length ?? '-'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border bg-background/50 p-4">
                    <pre className="max-h-[420px] whitespace-pre-wrap text-sm leading-6">
                      {parsePreview?.content ?? ''}
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="final" className="m-0 min-h-0 flex-1 overflow-auto p-4">
                  <div className="rounded-md border bg-background/50 p-4">
                    <div className="text-sm font-semibold">{t('knowledge.finalIndex')}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {strategy === 'raw'
                        ? t('knowledge.finalIndexRawDescription')
                        : t('knowledge.finalIndexCompressedDescription')}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-border/70 p-3">
                        <div className="text-xs text-muted-foreground">
                          {t('knowledge.embeddingInput')}
                        </div>
                        <div className="mt-1 text-sm font-medium">
                          {strategy === 'raw'
                            ? t('knowledge.rawChunks')
                            : t('knowledge.compressedChunks')}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 p-3">
                        <div className="text-xs text-muted-foreground">{t('knowledge.chunks')}</div>
                        <div className="mt-1 font-mono text-lg font-semibold">
                          {chunkStats.chunkCount}
                        </div>
                      </div>
                      <div className="rounded-md border border-border/70 p-3">
                        <div className="text-xs text-muted-foreground">{t('knowledge.tokens')}</div>
                        <div className="mt-1 font-mono text-lg font-semibold">
                          {chunkStats.tokenCount}
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
