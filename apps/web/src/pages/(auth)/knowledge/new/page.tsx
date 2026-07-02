import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, Input, Label, Textarea } from '@eous/ui'
import { ArrowLeft } from 'lucide-react'
import { api } from '../../../../lib/api'
import { useI18n } from '../../../../lib/i18n'

export default function NewKnowledgeBasePage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('knowledge.nameRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      await api.createKnowledgeBase({
        name: trimmedName,
        description: description.trim() || null,
      })
      navigate('/knowledge')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('knowledge.failedToCreate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_34rem)] px-6 py-6">
      <div className="flex flex-col gap-5">
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
              {t('knowledge.createEyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              {t('knowledge.createTitle')}
            </h1>
          </div>
        </header>

        <section className="flex flex-col gap-4 rounded-lg border bg-card/80 p-4 shadow-sm backdrop-blur">
          <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(360px,1fr)_auto] lg:items-end">
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
                className="min-h-10 resize-none"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('knowledge.descriptionPlaceholder')}
              />
            </div>
            <div className="flex gap-2">
              <Button asChild variant="ghost" disabled={saving}>
                <Link to="/knowledge">{t('settings.cancel')}</Link>
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? t('knowledge.creating') : t('settings.create')}
              </Button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-destructive/30 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
