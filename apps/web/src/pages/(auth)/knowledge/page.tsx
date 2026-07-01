import { useEffect, useMemo, useState } from 'react'
import type { KnowledgeBase, KnowledgeChunkPreview } from '@eous/api-client'
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
  Textarea,
} from '@eous/ui'
import { Database, FileText, Library, Plus, Scissors, Trash2 } from 'lucide-react'
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
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeBase | null>(null)
  const [importTarget, setImportTarget] = useState<KnowledgeBase | null>(null)
  const [importTitle, setImportTitle] = useState('')
  const [importContent, setImportContent] = useState('')
  const [preview, setPreview] = useState<KnowledgeChunkPreview | null>(null)
  const [previewing, setPreviewing] = useState(false)

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

  async function handleCreate() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('knowledge.nameRequired'))
      return
    }

    setCreating(true)
    setError(null)
    try {
      await api.createKnowledgeBase({
        name: trimmedName,
        description: description.trim() || null,
      })
      setDialogOpen(false)
      setName('')
      setDescription('')
      await loadKnowledgeBases()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToCreate'))
    } finally {
      setCreating(false)
    }
  }

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

  async function handlePreviewChunks() {
    if (!importTarget) return
    if (!importContent.trim()) {
      setError(t('knowledge.contentRequired'))
      return
    }

    setPreviewing(true)
    setError(null)
    try {
      const res = await api.previewKnowledgeChunks(importTarget.id, {
        content: importContent,
        config: {
          strategy: 'auto_structure',
          granularity: 50,
          overlap: 'standard',
          boundaryPreference: 'auto',
        },
      })
      setPreview(res.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToPreviewChunks'))
    } finally {
      setPreviewing(false)
    }
  }

  function openImportDialog(item: KnowledgeBase) {
    setImportTarget(item)
    setImportTitle('')
    setImportContent('')
    setPreview(null)
  }

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Library size={18} className="text-primary" />
            <h1 className="text-xl font-semibold">{t('knowledge.title')}</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{t('knowledge.description')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus size={16} />
          {t('knowledge.newKnowledgeBase')}
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
                      {t('knowledge.importText')}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('knowledge.newKnowledgeBase')}</DialogTitle>
            <DialogDescription>{t('knowledge.newDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('knowledge.name')}</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('knowledge.namePlaceholder')}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('knowledge.descriptionLabel')}</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('knowledge.descriptionPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? t('knowledge.creating') : t('settings.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <Dialog open={importTarget !== null} onOpenChange={(open) => !open && setImportTarget(null)}>
        <DialogContent className="sm:max-w-[920px]">
          <DialogHeader>
            <DialogTitle>{t('knowledge.importText')}</DialogTitle>
            <DialogDescription>
              {t('knowledge.importTextDescription').replace('{name}', importTarget?.name ?? '')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
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
                <Label>{t('knowledge.textContent')}</Label>
                <Textarea
                  className="min-h-[320px] font-mono text-xs"
                  value={importContent}
                  onChange={(event) => {
                    setImportContent(event.target.value)
                    setPreview(null)
                  }}
                  placeholder={t('knowledge.textContentPlaceholder')}
                />
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/20">
              <div className="flex items-center gap-2 border-b border-border p-3">
                <Scissors size={15} className="text-primary" />
                <div className="text-sm font-medium">{t('knowledge.chunkPreview')}</div>
              </div>
              {preview ? (
                <div className="space-y-3 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded border border-border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">
                        {t('knowledge.chunks')}
                      </div>
                      <div className="text-sm font-semibold">{preview.stats.chunkCount}</div>
                    </div>
                    <div className="rounded border border-border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">
                        {t('knowledge.tokens')}
                      </div>
                      <div className="text-sm font-semibold">{preview.stats.tokenCount}</div>
                    </div>
                    <div className="rounded border border-border bg-background p-2">
                      <div className="text-[11px] text-muted-foreground">
                        {t('knowledge.characters')}
                      </div>
                      <div className="text-sm font-semibold">{preview.stats.charCount}</div>
                    </div>
                  </div>
                  <div className="max-h-[300px] space-y-2 overflow-auto pr-1">
                    {preview.chunks.slice(0, 8).map((chunk) => (
                      <div
                        key={chunk.index}
                        className="rounded border border-border bg-background p-2"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>#{chunk.index + 1}</span>
                          <span>{chunk.tokenCount} tokens</span>
                        </div>
                        {chunk.metadata.sectionPath.length > 0 && (
                          <div className="mb-1 truncate text-[11px] text-primary">
                            {chunk.metadata.sectionPath.join(' / ')}
                          </div>
                        )}
                        <p className="line-clamp-4 whitespace-pre-wrap text-xs text-muted-foreground">
                          {chunk.content}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  {t('knowledge.chunkPreviewEmpty')}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportTarget(null)}>
              {t('settings.cancel')}
            </Button>
            <Button onClick={handlePreviewChunks} disabled={previewing}>
              <Scissors size={14} />
              {previewing ? t('knowledge.previewing') : t('knowledge.previewChunks')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
