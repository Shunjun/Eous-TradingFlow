import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { KnowledgeBase, KnowledgeDocument } from '@eous/api-client'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeDocument | null>(null)

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
      setKnowledgeBase(baseResult.knowledgeBase)
      setDocuments(documentResult.documents)
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
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToDeleteDocument'))
    }
  }

  function statusLabel(status: string): string {
    if (status === 'uploaded') return t('knowledge.statusUploaded')
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
            <Tabs defaultValue="documents" className="gap-0">
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
                          <Button variant="outline" size="sm" disabled>
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

              {['chunks', 'retrieval', 'indexes', 'runs'].map((tab) => (
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
