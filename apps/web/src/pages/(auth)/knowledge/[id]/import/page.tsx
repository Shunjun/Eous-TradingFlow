import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { KnowledgeBase } from '@eous/api-client'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eous/ui'
import { ArrowLeft, FileText, Upload } from 'lucide-react'
import { api } from '../../../../../lib/api'
import { useI18n } from '../../../../../lib/i18n'

type ImportStrategy = 'raw' | 'compressed' | 'hybrid'

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export default function KnowledgeImportPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null)
  const [title, setTitle] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [strategy, setStrategy] = useState<ImportStrategy>('raw')
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
      await api.uploadKnowledgeDocument(id, {
        file,
        title,
        strategy,
      })
      navigate(`/knowledge/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToUploadDocument'))
    } finally {
      setUploading(false)
    }
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
              <h2 className="text-sm font-semibold">{t('knowledge.importDocument')}</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                {loading
                  ? t('knowledge.loading')
                  : t('knowledge.importDocumentDescription').replace(
                      '{name}',
                      knowledgeBase?.name ?? '',
                    )}
              </p>
            </div>

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
                  <SelectItem value="compressed">{t('knowledge.strategyCompressed')}</SelectItem>
                  <SelectItem value="hybrid">{t('knowledge.strategyHybrid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mt-auto flex gap-2">
              <Button variant="ghost" disabled={uploading} onClick={() => navigate('/knowledge')}>
                {t('settings.cancel')}
              </Button>
              <Button onClick={handleUploadDocument} disabled={uploading || !file || !id}>
                <Upload size={14} />
                {uploading ? t('knowledge.uploading') : t('knowledge.uploadDocument')}
              </Button>
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

            <div className="flex flex-1 items-center justify-center border-t border-border p-8 text-center">
              <div className="max-w-md">
                <FileText size={28} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">{t('knowledge.documentPreviewTitle')}</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t('knowledge.documentPreviewDescription')}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
