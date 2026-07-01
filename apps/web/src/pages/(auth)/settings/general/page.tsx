import {
  Button,
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@eous/ui'
import type { ModelRef, Provider, ProviderModel, UserModelSettings } from '@eous/api-client'
import { Bot, Database, Languages, Save, Sliders, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { locales, type Locale } from '@eous/i18n'
import { useI18n, useLanguageSwitcher } from '../../../../lib/i18n'
import { api } from '../../../../lib/api'

const NONE_VALUE = '__none__'

interface ModelOption {
  value: string
  label: string
  providerId: string
  modelId: string
  capabilities: string[]
}

function modelValue(ref: ModelRef | null): string {
  return ref ? `${ref.providerId}::${ref.modelId}` : NONE_VALUE
}

function parseModelValue(value: string): ModelRef | null {
  if (!value || value === NONE_VALUE) return null
  const [providerId, modelId] = value.split('::')
  return providerId && modelId ? { providerId, modelId } : null
}

function buildModelOptions(
  providers: Provider[],
  modelsByProviderId: Record<string, ProviderModel[]>,
): ModelOption[] {
  return providers.flatMap((provider) =>
    (modelsByProviderId[provider.id] ?? [])
      .filter((model) => model.enabled)
      .map((model) => ({
        value: `${provider.id}::${model.modelId}`,
        label: `${model.displayName || model.modelId} (${provider.name})`,
        providerId: provider.id,
        modelId: model.modelId,
        capabilities: model.capabilities,
      })),
  )
}

function ModelSelect({
  label,
  description,
  icon: Icon,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string
  description: string
  icon: typeof Bot
  value: ModelRef | null
  options: ModelOption[]
  placeholder: string
  onChange: (value: ModelRef | null) => void
}) {
  return (
    <div className="grid gap-3 rounded-md border border-border bg-background/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center">
      <div className="flex gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
          <Icon size={16} className="text-primary" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{label}</div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <Select value={modelValue(value)} onValueChange={(next) => onChange(parseModelValue(next))}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function GeneralSettingsPage() {
  const { t, localeLabels } = useI18n()
  const { locale, setLocale } = useLanguageSwitcher()
  const [providers, setProviders] = useState<Provider[]>([])
  const [modelsByProviderId, setModelsByProviderId] = useState<Record<string, ProviderModel[]>>({})
  const [settings, setSettings] = useState<UserModelSettings>({
    chat: null,
    compression: null,
    embedding: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [providerRes, settingsRes] = await Promise.all([
          api.listProviders(),
          api.getModelSettings(),
        ])
        const modelEntries = await Promise.all(
          providerRes.providers.map(async (provider) => {
            try {
              const res = await api.getProvider(provider.id)
              return [provider.id, res.models] as const
            } catch {
              return [provider.id, []] as const
            }
          }),
        )

        if (cancelled) return
        setProviders(providerRes.providers)
        setModelsByProviderId(Object.fromEntries(modelEntries))
        setSettings(settingsRes.settings)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('settings.failedToLoadModelSettings'))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [t])

  const modelOptions = useMemo(
    () => buildModelOptions(providers, modelsByProviderId),
    [modelsByProviderId, providers],
  )
  const textModelOptions = useMemo(
    () => modelOptions.filter((option) => !option.capabilities.includes('embedding')),
    [modelOptions],
  )
  const embeddingModelOptions = useMemo(
    () => modelOptions.filter((option) => option.capabilities.includes('embedding')),
    [modelOptions],
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await api.updateModelSettings(settings)
      setSettings(res.settings)
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToSaveModelSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Sliders} title={t('settings.generalTitle')} />
        <CardPanelBody className="p-6 space-y-6">
          <section className="flex flex-col gap-4 rounded-md border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Languages size={16} className="text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">
                  {t('settings.languageTitle')}
                </h2>
                <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {t('settings.languageDescription')}
                </p>
              </div>
            </div>

            <div className="min-w-48 space-y-1.5">
              <Label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                {t('settings.languageLabel')}
              </Label>
              <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locales.map((item) => (
                    <SelectItem key={item} value={item}>
                      {localeLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-4 rounded-md border border-border bg-muted/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-foreground">
                  {t('settings.defaultModelsTitle')}
                </h2>
                <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
                  {t('settings.defaultModelsDescription')}
                </p>
              </div>
              <Button size="sm" onClick={handleSave} disabled={loading || saving}>
                <Save size={14} />
                {saving ? t('settings.saving') : t('settings.save')}
              </Button>
            </div>

            {loading ? (
              <div className="rounded-md border border-border bg-background/70 p-4 text-sm text-muted-foreground">
                {t('settings.loadingModelSettings')}
              </div>
            ) : (
              <div className="space-y-3">
                <ModelSelect
                  label={t('settings.defaultChatModel')}
                  description={t('settings.defaultChatModelDescription')}
                  icon={Bot}
                  value={settings.chat}
                  options={textModelOptions}
                  placeholder={t('settings.noDefaultModel')}
                  onChange={(chat) => setSettings((current) => ({ ...current, chat }))}
                />
                <ModelSelect
                  label={t('settings.defaultCompressionModel')}
                  description={t('settings.defaultCompressionModelDescription')}
                  icon={Sparkles}
                  value={settings.compression}
                  options={textModelOptions}
                  placeholder={t('settings.noDefaultModel')}
                  onChange={(compression) =>
                    setSettings((current) => ({ ...current, compression }))
                  }
                />
                <ModelSelect
                  label={t('settings.defaultEmbeddingModel')}
                  description={t('settings.defaultEmbeddingModelDescription')}
                  icon={Database}
                  value={settings.embedding}
                  options={embeddingModelOptions}
                  placeholder={t('settings.noDefaultModel')}
                  onChange={(embedding) => setSettings((current) => ({ ...current, embedding }))}
                />
              </div>
            )}

            {error && <div className="text-xs text-destructive">{error}</div>}
            {savedAt && (
              <div className="text-xs text-muted-foreground">
                {t('settings.savedAt').replace('{time}', savedAt)}
              </div>
            )}
          </section>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
