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
import { ArrowLeft, ChevronDown, Combine, FileText, Scissors, Upload, X } from 'lucide-react'
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

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || fileName
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
  const [expandedChunkIndexes, setExpandedChunkIndexes] = useState<number[]>([])
  const [splitPositions, setSplitPositions] = useState<Record<number, number>>({})
  const [chunkConfig, setChunkConfig] = useState<KnowledgeChunkingConfig>({
    strategy: 'auto_structure',
    granularity: 50,
    overlap: 'standard',
    boundaryPreference: 'auto',
    maxChunks: 500,
  })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [startingRun, setStartingRun] = useState(false)
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

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile)
    setTitle(nextFile ? titleFromFileName(nextFile.name) : '')
  }

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
      setExpandedChunkIndexes([])
      setSplitPositions({})
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToPreviewChunks'))
    } finally {
      setChunking(false)
    }
  }

  function updateChunkConfig(next: KnowledgeChunkingConfig) {
    setChunkConfig((current) => ({ ...current, ...next }))
  }

  function toggleExpandedChunk(index: number) {
    setExpandedChunkIndexes((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
    )
  }

  function setChunkSplitPosition(index: number, position: number) {
    const chunk = chunks[index]
    if (!chunk) return
    const nextPosition = Math.max(0, Math.min(position, chunk.content.length))
    setSplitPositions((current) => ({ ...current, [index]: nextPosition }))
  }

  function mergeChunksAt(index: number) {
    const first = chunks[index]
    const second = chunks[index + 1]
    if (!first || !second) return

    const mergedContent = [first.content, second.content].join('\n\n')
    const merged: LocalChunk = {
      ...first,
      content: mergedContent,
      charCount: mergedContent.length,
      tokenCount: estimateTokenCount(mergedContent),
    }
    const next = [...chunks.slice(0, index), merged, ...chunks.slice(index + 2)]
    setChunks(reindexChunks(next))
    setExpandedChunkIndexes([index])
    setSplitPositions({})
    setError(null)
  }

  function splitChunkAt(index: number) {
    const chunk = chunks[index]
    if (!chunk) return
    const position = Math.max(1, Math.min(splitPositions[index] ?? 0, chunk.content.length - 1))
    const leftContent = chunk.content.slice(0, position).trim()
    const rightContent = chunk.content.slice(position).trim()
    if (!leftContent || !rightContent) {
      setError(t('knowledge.invalidSplitPosition'))
      return
    }

    const left: LocalChunk = {
      ...chunk,
      content: leftContent,
      charCount: leftContent.length,
      tokenCount: estimateTokenCount(leftContent),
    }
    const right: LocalChunk = {
      ...chunk,
      content: rightContent,
      charCount: rightContent.length,
      tokenCount: estimateTokenCount(rightContent),
    }
    const next = [...chunks.slice(0, index), left, right, ...chunks.slice(index + 1)]
    setChunks(reindexChunks(next))
    setExpandedChunkIndexes([index, index + 1])
    setSplitPositions({})
    setError(null)
  }

  async function handleFinishImport() {
    if (!id || !document) return
    if (chunks.length === 0) {
      setError(t('knowledge.chunkRequired'))
      return
    }

    setStartingRun(true)
    setError(null)
    try {
      await api.createKnowledgeIngestionRun(document.id, {
        strategy,
        chunkConfig: { ...chunkConfig },
        chunks: chunks.map((chunk) => ({
          content: chunk.content,
          tokenCount: chunk.tokenCount,
          metadata: chunk.metadata,
        })),
      })
      navigate(`/knowledge/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToStartIngestion'))
    } finally {
      setStartingRun(false)
    }
  }

  return (
    <div className="h-full overflow-hidden bg-background px-6 py-6">
      <div className="flex h-full min-h-0 flex-col gap-5">
        <header className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground">
            <Link to="/knowledge">
              <ArrowLeft size={15} />
              {t('knowledge.backToKnowledge')}
            </Link>
          </Button>
          <div className="h-5 w-px bg-border" />
          <h1 className="truncate text-xl font-semibold tracking-normal text-foreground">
            {knowledgeBase?.name ?? t('knowledge.importDocument')}
          </h1>
        </header>

        <div
          className={
            step === 'source'
              ? 'flex min-h-0 flex-1 items-center justify-center'
              : 'grid min-h-0 flex-1 overflow-hidden border-t border-border xl:grid-cols-[380px_minmax(0,1fr)]'
          }
        >
          <aside
            className={
              step === 'source'
                ? 'flex w-full max-w-3xl flex-col gap-6'
                : 'flex min-h-0 flex-col gap-4 overflow-auto border-r border-border p-4'
            }
          >
            <div
              className={step === 'source' ? 'space-y-1 border-b border-border pb-5' : 'space-y-1'}
            >
              <h2
                className={
                  step === 'source'
                    ? 'text-lg font-semibold tracking-normal'
                    : 'text-sm font-semibold'
                }
              >
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
                  <Label>{t('knowledge.documentFile')}</Label>
                  {file ? (
                    <div className="flex min-h-[120px] items-center justify-between gap-4 border border-border bg-muted/20 px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText size={24} className="shrink-0 text-primary" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{displayTitle}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {file.name} · {formatFileSize(file.size)}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <label className="inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                          {t('knowledge.selectDocumentFile')}
                          <Input
                            className="hidden"
                            type="file"
                            accept=".txt,.md,.markdown,.pdf,.docx,.epub,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
                            onChange={(event) => {
                              handleFileChange(event.target.files?.[0] ?? null)
                            }}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost-icon"
                          size="sm"
                          className="h-9 w-9"
                          onClick={() => handleFileChange(null)}
                        >
                          <X size={15} />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition hover:bg-muted/40">
                      <Upload size={22} className="text-primary" />
                      <div className="mt-3 max-w-full truncate text-sm font-medium">
                        {t('knowledge.selectDocumentFile')}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t('knowledge.documentFileHint')}
                      </div>
                      <Input
                        className="hidden"
                        type="file"
                        accept=".txt,.md,.markdown,.pdf,.docx,.epub,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
                        onChange={(event) => {
                          handleFileChange(event.target.files?.[0] ?? null)
                        }}
                      />
                    </label>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="border-b border-border pb-4">
                  <div className="text-xs text-muted-foreground">
                    {t('knowledge.currentDocument')}
                  </div>
                  <div className="mt-1 truncate text-sm font-medium">
                    {document?.title ?? displayTitle}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{strategyLabel}</div>
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

                <div className="grid grid-cols-3 divide-x divide-border border-y border-border">
                  <div className="p-2">
                    <div className="text-[11px] text-muted-foreground">{t('knowledge.chunks')}</div>
                    <div className="font-mono text-lg font-semibold">{chunkStats.chunkCount}</div>
                  </div>
                  <div className="p-2">
                    <div className="text-[11px] text-muted-foreground">{t('knowledge.tokens')}</div>
                    <div className="font-mono text-lg font-semibold">{chunkStats.tokenCount}</div>
                  </div>
                  <div className="p-2">
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

            <div
              className={
                step === 'source'
                  ? 'flex items-center justify-between gap-2'
                  : 'mt-auto flex flex-wrap gap-2'
              }
            >
              <Button variant="ghost" disabled={uploading} onClick={() => navigate('/knowledge')}>
                {t('settings.cancel')}
              </Button>
              {step === 'source' ? (
                <Button onClick={handleUploadDocument} disabled={uploading || !file || !id}>
                  {uploading ? t('knowledge.uploading') : '下一步'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    disabled={chunking || startingRun || !document}
                    onClick={() => document && loadDocumentPreview(document.id)}
                  >
                    {chunking ? t('knowledge.previewing') : t('knowledge.recalculateChunks')}
                  </Button>
                  <Button
                    onClick={handleFinishImport}
                    disabled={startingRun || chunks.length === 0}
                  >
                    {startingRun ? t('knowledge.startingIngestion') : t('knowledge.finishImport')}
                  </Button>
                </>
              )}
            </div>
          </aside>

          {step === 'chunking' && (
            <section className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText size={16} className="text-primary" />
                  <div className="truncate text-sm font-semibold">{displayTitle}</div>
                </div>
                <span className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground">
                  {strategyLabel}
                </span>
              </div>
              <Tabs defaultValue="chunks" className="flex min-h-0 flex-1 flex-col gap-0">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <TabsList variant="line" className="h-9 justify-start">
                    <TabsTrigger value="chunks">{t('knowledge.rawChunks')}</TabsTrigger>
                    <TabsTrigger value="parsed">{t('knowledge.parsedDocument')}</TabsTrigger>
                    <TabsTrigger value="final">{t('knowledge.finalIndex')}</TabsTrigger>
                  </TabsList>
                  <div className="text-xs text-muted-foreground">
                    {chunkStats.chunkCount} chunks · {chunkStats.tokenCount} tokens
                  </div>
                </div>

                <TabsContent
                  value="chunks"
                  className="m-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
                >
                  <div className="h-full min-h-0 overflow-auto px-4 py-4">
                    {chunks.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">
                        {chunking ? t('knowledge.previewing') : t('knowledge.chunkPreviewEmpty')}
                      </div>
                    ) : (
                      <div className="mx-auto flex max-w-5xl flex-col gap-2">
                        {chunks.map((chunk, index) => {
                          const expanded = expandedChunkIndexes.includes(index)
                          const splitPosition = splitPositions[index] ?? 0
                          return (
                            <div key={chunk.index}>
                              <section className="bg-muted/20 px-4 py-3 transition hover:bg-muted/30">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandedChunk(index)}
                                  className="flex w-full items-start justify-between gap-4 text-left"
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="text-sm font-medium">
                                        {t('knowledge.chunkNumber').replace(
                                          '{number}',
                                          String(index + 1),
                                        )}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {chunk.tokenCount} tokens · {chunk.charCount} chars
                                      </span>
                                    </div>
                                    <div className="mt-1 truncate text-xs text-muted-foreground">
                                      {chunk.metadata.sectionPath.join(' / ') ||
                                        t('knowledge.noSection')}
                                    </div>
                                  </div>
                                  <ChevronDown
                                    size={16}
                                    className={
                                      'mt-0.5 shrink-0 text-muted-foreground transition-transform ' +
                                      (expanded ? 'rotate-180' : '')
                                    }
                                  />
                                </button>

                                {expanded ? (
                                  <div className="mt-3 space-y-3">
                                    <textarea
                                      className="min-h-[220px] w-full resize-y border border-border bg-background px-3 py-2 font-mono text-sm leading-6 outline-none transition focus:border-primary"
                                      value={chunk.content}
                                      onClick={(event) =>
                                        setChunkSplitPosition(
                                          index,
                                          event.currentTarget.selectionStart,
                                        )
                                      }
                                      onKeyUp={(event) =>
                                        setChunkSplitPosition(
                                          index,
                                          event.currentTarget.selectionStart,
                                        )
                                      }
                                      onSelect={(event) =>
                                        setChunkSplitPosition(
                                          index,
                                          event.currentTarget.selectionStart,
                                        )
                                      }
                                      onChange={(event) => {
                                        const nextContent = event.target.value
                                        setChunks((current) =>
                                          reindexChunks(
                                            current.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? { ...item, content: nextContent }
                                                : item,
                                            ),
                                          ),
                                        )
                                        setChunkSplitPosition(index, event.target.selectionStart)
                                      }}
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="text-xs text-muted-foreground">
                                        光标位置 {splitPosition || '-'} / {chunk.content.length}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                          splitPosition <= 0 ||
                                          splitPosition >= chunk.content.length ||
                                          chunk.content.length < 2
                                        }
                                        onClick={() => splitChunkAt(index)}
                                      >
                                        <Scissors size={14} />
                                        在光标处分割
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                    {chunk.content}
                                  </p>
                                )}
                              </section>

                              {index < chunks.length - 1 && (
                                <div className="group relative flex h-8 items-center justify-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 translate-y-0 opacity-0 shadow-sm transition group-hover:opacity-100"
                                    onClick={() => mergeChunksAt(index)}
                                  >
                                    <Combine size={14} />
                                    合并上下分片
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent
                  value="parsed"
                  className="m-0 min-h-0 flex-1 overflow-auto p-4 data-[state=inactive]:hidden"
                >
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

                <TabsContent
                  value="final"
                  className="m-0 min-h-0 flex-1 overflow-auto p-4 data-[state=inactive]:hidden"
                >
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
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
