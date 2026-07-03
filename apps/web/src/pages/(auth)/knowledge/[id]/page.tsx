import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type {
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  KnowledgeIngestionRun,
  KnowledgeRetrievalResult,
} from '@eous/api-client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@eous/ui'
import { ArrowLeft, Database, FileText, Layers3, Plus, Search, Trash2 } from 'lucide-react'
import { PageLoading } from '../../../../components/PageLoading'
import { api } from '../../../../lib/api'
import { useI18n } from '../../../../lib/i18n'

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

function formatFileSize(size: number | null): string {
  if (size === null) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function statusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'indexed') return 'default'
  if (status === 'failed') return 'destructive'
  if (status === 'uploaded') return 'secondary'
  return 'outline'
}

export default function KnowledgeDetailPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [runs, setRuns] = useState<KnowledgeIngestionRun[]>([])
  const [activeTab, setActiveTab] = useState('documents')
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(null)
  const [retrievalQuery, setRetrievalQuery] = useState('')
  const [retrievalTopK, setRetrievalTopK] = useState(5)
  const [retrievalThreshold, setRetrievalThreshold] = useState(0)
  const [retrievalResult, setRetrievalResult] = useState<KnowledgeRetrievalResult | null>(null)
  const [retrievalLoading, setRetrievalLoading] = useState(false)
  const [retrievalError, setRetrievalError] = useState<string | null>(null)

  const stats = useMemo(
    () => ({
      documents: documents.length,
      indexed: documents.filter((item) => item.status === 'indexed').length,
      uploaded: documents.filter((item) => item.status === 'uploaded').length,
    }),
    [documents],
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [baseResult, documentResult] = await Promise.all([
        api.getKnowledgeBase(id),
        api.listKnowledgeDocuments(id),
      ])
      const [runResult, chunkGroups] = await Promise.all([
        api.listKnowledgeIngestionRuns(id),
        Promise.all(
          documentResult.documents.map((document) =>
            api
              .listKnowledgeDocumentChunks(document.id)
              .then((res) => res.chunks)
              .catch(() => []),
          ),
        ),
      ])
      setKnowledgeBase(baseResult.knowledgeBase)
      setDocuments(documentResult.documents)
      setRuns(runResult.runs)
      setChunks(chunkGroups.flat())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }, [id, t])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDeleteDocument() {
    if (!pendingDelete) return
    setError(null)
    try {
      await api.deleteKnowledgeDocument(pendingDelete.id)
      setDocuments((current) => current.filter((item) => item.id !== pendingDelete.id))
      setChunks((current) => current.filter((item) => item.documentId !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToDeleteDocument'))
    }
  }

  async function handleRetrieve() {
    if (!id || !retrievalQuery.trim()) return
    setRetrievalLoading(true)
    setRetrievalError(null)
    try {
      const result = await api.retrieveKnowledge(id, {
        query: retrievalQuery,
        topK: retrievalTopK,
        scoreThreshold: retrievalThreshold,
        maxContextTokens: 2000,
        retrievalMode: 'vector',
      })
      setRetrievalResult(result)
    } catch (err) {
      setRetrievalError(err instanceof Error ? err.message : '检索失败')
    } finally {
      setRetrievalLoading(false)
    }
  }

  function statusLabel(status: string): string {
    if (status === 'uploaded') return t('knowledge.statusUploaded')
    if (status === 'chunked') return t('knowledge.statusChunked')
    if (status === 'queued') return t('knowledge.statusQueued')
    if (status === 'embedding') return t('knowledge.statusEmbedding')
    if (status === 'parsing') return t('knowledge.statusParsing')
    if (status === 'processing') return t('knowledge.statusProcessing')
    if (status === 'indexed') return t('knowledge.statusIndexed')
    if (status === 'failed') return t('knowledge.statusFailed')
    return status
  }

  function strategyLabel(strategy: string): string {
    if (strategy === 'compressed') return t('knowledge.strategyCompressed')
    if (strategy === 'hybrid') return t('knowledge.strategyHybrid')
    return t('knowledge.strategyRaw')
  }

  const documentById = new Map(documents.map((document) => [document.id, document]))
  const visibleChunks = selectedDocumentId
    ? chunks.filter((chunk) => chunk.documentId === selectedDocumentId)
    : chunks

  if (!id) return null
  if (loading || !knowledgeBase) return <PageLoading label={t('knowledge.loading')} />

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_30rem)] px-6 py-6">
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-3 gap-2 px-0">
              <Link to="/knowledge">
                <ArrowLeft size={15} />
                {t('knowledge.backToKnowledge')}
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{knowledgeBase.name}</h1>
              <Badge variant={knowledgeBase.enabled ? 'default' : 'outline'}>
                {knowledgeBase.enabled ? t('knowledge.enabled') : t('knowledge.disabled')}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {knowledgeBase.description || t('knowledge.noDescription')}
            </p>
            <div className="mt-2 text-xs text-muted-foreground">
              {t('knowledge.updatedAt').replace('{time}', formatDate(knowledgeBase.updatedAt))}
            </div>
          </div>

          <Button asChild className="w-fit gap-2">
            <Link to={`/knowledge/${knowledgeBase.id}/import`}>
              <Plus size={16} />
              {t('knowledge.importDocument')}
            </Link>
          </Button>
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            { label: t('knowledge.documents'), value: stats.documents, icon: FileText },
            { label: t('knowledge.indexedDocuments'), value: stats.indexed, icon: Database },
            { label: t('knowledge.uploadedDocuments'), value: stats.uploaded, icon: Layers3 },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border bg-card/85 p-3 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.label}</span>
                <item.icon size={15} className="text-primary" />
              </div>
              <div className="mt-2 truncate font-mono text-xl font-semibold">{item.value}</div>
            </div>
          ))}
        </section>

        {error && <div className="rounded-md border p-3 text-sm text-destructive">{error}</div>}

        <Card className="gap-0 rounded-lg py-0">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-base">{t('knowledge.library')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-0">
              <div className="border-b px-4 pt-3">
                <TabsList variant="line" className="h-9 justify-start">
                  <TabsTrigger value="documents">{t('knowledge.documents')}</TabsTrigger>
                  <TabsTrigger value="chunks">{t('knowledge.chunks')}</TabsTrigger>
                  <TabsTrigger value="retrieval">{t('knowledge.retrievalTest')}</TabsTrigger>
                  <TabsTrigger value="indexes">{t('knowledge.indexes')}</TabsTrigger>
                  <TabsTrigger value="runs">{t('knowledge.runs')}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="documents" className="m-0">
                {documents.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <FileText size={30} className="mx-auto text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">{t('knowledge.noDocumentsTitle')}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t('knowledge.noDocumentsDescription')}
                      </p>
                      <Button asChild className="mt-4">
                        <Link to={`/knowledge/${knowledgeBase.id}/import`}>
                          <Plus size={15} />
                          {t('knowledge.importDocument')}
                        </Link>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-medium">{document.title}</div>
                            <Badge variant={statusVariant(document.status)}>
                              {statusLabel(document.status)}
                            </Badge>
                            <Badge variant="outline">{strategyLabel(document.strategy)}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>{document.sourceFileName ?? t('knowledge.noFileName')}</span>
                            <span>{formatFileSize(document.sourceSize)}</span>
                            <span>{document.sourceMimeType || '-'}</span>
                            <span>
                              {t('knowledge.updatedAt').replace(
                                '{time}',
                                formatDate(document.updatedAt),
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDocumentId(document.id)
                              setActiveTab('chunks')
                            }}
                          >
                            <Search size={14} />
                            {t('knowledge.viewChunks')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-9 p-0"
                            onClick={() => setPendingDelete(document)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="chunks" className="m-0">
                {visibleChunks.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <Database size={28} className="mx-auto text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">{t('knowledge.noChunksTitle')}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t('knowledge.noChunksDescription')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between border-b px-4 py-3">
                      <div className="text-sm text-muted-foreground">
                        {selectedDocumentId
                          ? documentById.get(selectedDocumentId)?.title
                          : t('knowledge.allDocuments')}
                      </div>
                      {selectedDocumentId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedDocumentId(null)}
                        >
                          {t('knowledge.showAllChunks')}
                        </Button>
                      )}
                    </div>
                    <div className="divide-y">
                      {visibleChunks.map((chunk) => (
                        <div key={chunk.id} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <div className="text-sm font-medium">
                                {t('knowledge.chunkNumber').replace(
                                  '{number}',
                                  String(chunk.chunkIndex + 1),
                                )}
                              </div>
                              <Badge variant="outline">{chunk.kind}</Badge>
                              <Badge variant="secondary">{chunk.embeddingRole}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {chunk.tokenCount} tokens
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {documentById.get(chunk.documentId)?.title ?? chunk.documentId}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                            {chunk.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="runs" className="m-0">
                {runs.length === 0 ? (
                  <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <Database size={28} className="mx-auto text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">{t('knowledge.noRunsTitle')}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t('knowledge.noRunsDescription')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {runs.map((run) => (
                      <div
                        key={run.id}
                        className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-sm font-medium">
                              {documentById.get(run.documentId)?.title ?? run.documentId}
                            </div>
                            <Badge variant="outline">{run.status}</Badge>
                            <Badge variant="secondary">{strategyLabel(run.strategy)}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              {t('knowledge.runStarted').replace(
                                '{time}',
                                run.startedAt ? formatDate(run.startedAt) : '-',
                              )}
                            </span>
                            <span>
                              {t('knowledge.runFinished').replace(
                                '{time}',
                                run.finishedAt ? formatDate(run.finishedAt) : '-',
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">{run.id}</div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="retrieval" className="m-0">
                <div className="grid min-h-[520px] lg:grid-cols-[360px_minmax(0,1fr)]">
                  <aside className="border-r p-4">
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label>检索问题</Label>
                        <Textarea
                          value={retrievalQuery}
                          onChange={(event) => setRetrievalQuery(event.target.value)}
                          placeholder="输入一个问题，测试当前知识库的召回结果"
                          className="min-h-28"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Top K</Label>
                          <Input
                            type="number"
                            min={1}
                            max={50}
                            value={retrievalTopK}
                            onChange={(event) => setRetrievalTopK(Number(event.target.value))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Threshold</Label>
                          <Input
                            type="number"
                            min={-1}
                            max={1}
                            step={0.05}
                            value={retrievalThreshold}
                            onChange={(event) => setRetrievalThreshold(Number(event.target.value))}
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full"
                        disabled={retrievalLoading || !retrievalQuery.trim()}
                        onClick={handleRetrieve}
                      >
                        {retrievalLoading ? '检索中...' : '检索测试'}
                      </Button>
                      {retrievalError && (
                        <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                          {retrievalError}
                        </div>
                      )}
                    </div>
                  </aside>
                  <section className="min-w-0 p-4">
                    {!retrievalResult ? (
                      <div className="flex min-h-[420px] items-center justify-center text-center">
                        <div className="max-w-md">
                          <Search size={28} className="mx-auto text-muted-foreground" />
                          <p className="mt-3 text-sm font-medium">暂无检索结果</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            输入问题后会展示召回 chunks、分数和拼接后的 context。
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div>
                          <div className="mb-2 text-sm font-medium">Context</div>
                          <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm leading-6">
                            {retrievalResult.context || '无可用 context'}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-2 text-sm font-medium">
                            Chunks ({retrievalResult.chunks.length})
                          </div>
                          <div className="space-y-2">
                            {retrievalResult.chunks.map((chunk) => (
                              <div key={chunk.chunkId} className="border bg-muted/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="truncate text-sm font-medium">
                                    {chunk.documentTitle}
                                  </div>
                                  <div className="font-mono text-xs text-muted-foreground">
                                    {chunk.score.toFixed(4)}
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Chunk {chunk.chunkIndex + 1} · {chunk.tokenCount} tokens
                                </div>
                                <p className="mt-2 line-clamp-5 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                                  {chunk.content}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </TabsContent>

              {['indexes'].map((tab) => (
                <TabsContent key={tab} value={tab} className="m-0">
                  <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                    <div className="max-w-md">
                      <Database size={28} className="mx-auto text-muted-foreground" />
                      <p className="mt-3 text-sm font-medium">{t('knowledge.comingSoonTitle')}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t('knowledge.comingSoonDescription')}
                      </p>
                    </div>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={t('knowledge.deleteDocumentTitle').replace('{name}', pendingDelete?.title ?? '')}
          description={t('knowledge.deleteDocumentDescription')}
          confirmLabel={t('settings.delete')}
          cancelLabel={t('settings.cancel')}
          onConfirm={handleDeleteDocument}
          destructive
        />
      </div>
    </div>
  )
}
