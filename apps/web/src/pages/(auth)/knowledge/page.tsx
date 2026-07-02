import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { KnowledgeBase } from '@eous/api-client'
import {
  Button,
  CardPanel,
  CardPanelBody,
  CardPanelHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@eous/ui'
import { Database, FileText, Library, Plus, Trash2, Upload } from 'lucide-react'
import { api } from '../../../lib/api'
import { useI18n } from '../../../lib/i18n'

function formatDate(value: string): string {
  return new Date(value).toLocaleString()
}

export default function KnowledgePage() {
  const { t } = useI18n()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBase | null>(null)
  const [importTarget, setImportTarget] = useState<KnowledgeBase | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const enabledCount = useMemo(
    () => knowledgeBases.filter((item) => item.enabled).length,
    [knowledgeBases],
  )

  async function loadKnowledgeBases() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.listKnowledgeBases()
      setKnowledgeBases(res.knowledgeBases)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadKnowledgeBases()
  }, [])

  async function handleToggleEnabled(item: KnowledgeBase) {
    setError(null)
    try {
      const res = await api.updateKnowledgeBase(item.id, { enabled: !item.enabled })
      setKnowledgeBases((current) =>
        current.map((entry) => (entry.id === item.id ? res.knowledgeBase : entry)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToUpdate'))
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return
    setError(null)
    try {
      await api.deleteKnowledgeBase(pendingDelete.id)
      setKnowledgeBases((current) => current.filter((item) => item.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToDelete'))
    }
  }

  async function handleUploadDocument() {
    if (!importTarget) return
    if (!importFile) {
      setError(t('knowledge.fileRequired'))
      return
    }

    setUploading(true)
    setError(null)
    try {
      await api.uploadKnowledgeDocument(importTarget.id, {
        file: importFile,
        title: importTitle,
        strategy: 'raw',
      })
      setImportTarget(null)
      setImportTitle('')
      setImportFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToUploadDocument'))
    } finally {
      setUploading(false)
    }
  }

  function openImportDialog(item: KnowledgeBase) {
    setImportTarget(item)
    setImportTitle('')
    setImportFile(null)
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_34rem)] px-6 py-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Library size={18} className="text-primary" />
              <h1 className="text-xl font-semibold">{t('knowledge.title')}</h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">{t('knowledge.description')}</p>
          </div>
          <Button asChild>
            <Link to="/knowledge/new">
              <Plus size={16} />
              {t('knowledge.newKnowledgeBase')}
            </Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <CardPanel>
            <CardPanelBody className="p-4">
              <div className="text-xs text-muted-foreground">{t('knowledge.total')}</div>
              <div className="mt-1 text-2xl font-semibold">{knowledgeBases.length}</div>
            </CardPanelBody>
          </CardPanel>
          <CardPanel>
            <CardPanelBody className="p-4">
              <div className="text-xs text-muted-foreground">{t('knowledge.enabled')}</div>
              <div className="mt-1 text-2xl font-semibold">{enabledCount}</div>
            </CardPanelBody>
          </CardPanel>
          <CardPanel>
            <CardPanelBody className="p-4">
              <div className="text-xs text-muted-foreground">{t('knowledge.disabled')}</div>
              <div className="mt-1 text-2xl font-semibold">
                {knowledgeBases.length - enabledCount}
              </div>
            </CardPanelBody>
          </CardPanel>
        </div>

        <CardPanel>
          <CardPanelHeader icon={Database} title={t('knowledge.library')} />
          <CardPanelBody className="p-0">
            {error && (
              <div className="border-b border-border p-4 text-sm text-destructive">{error}</div>
            )}
            {loading ? (
              <div className="p-6 text-sm text-muted-foreground">{t('knowledge.loading')}</div>
            ) : knowledgeBases.length === 0 ? (
              <div className="p-6">
                <div className="text-sm font-medium">{t('knowledge.emptyTitle')}</div>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {t('knowledge.emptyDescription')}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {knowledgeBases.map((item) => (
                  <div
                    key={item.id}
                    className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-medium">{item.name}</div>
                        <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          {item.enabled ? t('knowledge.enabled') : t('knowledge.disabled')}
                        </span>
                      </div>
                      <p className="max-w-3xl text-sm text-muted-foreground">
                        {item.description || t('knowledge.noDescription')}
                      </p>
                      <div className="text-xs text-muted-foreground">
                        {t('knowledge.updatedAt').replace('{time}', formatDate(item.updatedAt))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" onClick={() => openImportDialog(item)}>
                        <FileText size={14} />
                        {t('knowledge.importDocument')}
                      </Button>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.enabled}
                          onCheckedChange={() => void handleToggleEnabled(item)}
                          aria-label={t('knowledge.toggleEnabled')}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-9 p-0"
                        onClick={() => setPendingDelete(item)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardPanelBody>
        </CardPanel>

        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={t('knowledge.deleteTitle').replace('{name}', pendingDelete?.name ?? '')}
          description={t('knowledge.deleteDescription')}
          confirmLabel={t('settings.delete')}
          cancelLabel={t('settings.cancel')}
          onConfirm={handleDelete}
          destructive
        />

        <Dialog
          open={importTarget !== null}
          onOpenChange={(open) => !open && setImportTarget(null)}
        >
          <DialogContent className="sm:max-w-[720px]">
            <DialogHeader>
              <DialogTitle>{t('knowledge.importDocument')}</DialogTitle>
              <DialogDescription>
                {t('knowledge.importDocumentDescription').replace(
                  '{name}',
                  importTarget?.name ?? '',
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('knowledge.documentTitle')}</Label>
                <Input
                  value={importTitle}
                  onChange={(event) => setImportTitle(event.target.value)}
                  placeholder={t('knowledge.documentTitlePlaceholder')}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('knowledge.documentFile')}</Label>
                <label className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition hover:bg-muted/40">
                  <Upload size={22} className="text-primary" />
                  <div className="mt-3 text-sm font-medium">
                    {importFile ? importFile.name : t('knowledge.selectDocumentFile')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {importFile
                      ? `${Math.ceil(importFile.size / 1024)} KB`
                      : t('knowledge.documentFileHint')}
                  </div>
                  <Input
                    className="hidden"
                    type="file"
                    accept=".txt,.md,.markdown,.pdf,.docx,.epub,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip"
                    onChange={(event) => {
                      setImportFile(event.target.files?.[0] ?? null)
                    }}
                  />
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setImportTarget(null)}>
                {t('settings.cancel')}
              </Button>
              <Button onClick={handleUploadDocument} disabled={uploading}>
                <Upload size={14} />
                {uploading ? t('knowledge.uploading') : t('knowledge.uploadDocument')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
