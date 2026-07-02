import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  DataRow,
  Button,
  Input,
  Label,
  IconBox,
  StatusBadge,
  Badge,
  Skeleton,
  Empty,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  cn,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ConfirmDialog,
  Switch,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Separator,
} from '@eous/ui'
import {
  Brain,
  Bot,
  Database,
  Eye,
  Plus,
  X,
  Trash2,
  RefreshCw,
  Zap,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Save,
  ServerCog,
  Route,
  Search,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type {
  Provider,
  ProviderModel,
  ProviderRemoteModel,
  ProviderTemplate,
  TestResult,
  ModelRef,
  UserModelSettings,
} from '@eous/api-client'
import type { TextKey } from '@eous/i18n'
import { api } from '@/lib/api'
import { PageLoading } from '../../../../components/PageLoading'
import { useI18n } from '../../../../lib/i18n'

/* ── Capability color map ──────────────────────────────── */

const CAP_COLORS: Record<string, string> = {
  vision: 'text-purple-400 bg-purple-400/10',
  reasoning: 'text-orange-400 bg-orange-400/10',
  embedding: 'text-amber-400 bg-amber-400/10',
}

const CAPABILITY_OPTIONS: {
  value: 'reasoning' | 'vision' | 'embedding'
  labelKey: TextKey
  icon: LucideIcon
}[] = [
  { value: 'reasoning', labelKey: 'settings.capabilityReasoning', icon: Brain },
  { value: 'vision', labelKey: 'settings.capabilityVision', icon: Eye },
  { value: 'embedding', labelKey: 'settings.capabilityEmbedding', icon: Database },
]

const API_FORMAT_LABELS: Record<string, string> = {
  'openai-compatible': 'OpenAI Compatible',
  'openai-chat': 'OpenAI Compatible',
  'openai-responses': 'OpenAI Responses',
  'anthropic-messages': 'Anthropic Messages',
  'google-generative': 'Google Generative',
}

const FALLBACK_API_FORMATS = Object.entries(API_FORMAT_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const MANUAL_MODEL_OPTION = '__manual_model__'
const NONE_VALUE = '__none__'

type Translate = (key: TextKey) => string

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
  icon: LucideIcon
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

function normalizeCapabilities(input: string[]): string[] {
  return [...new Set(input.map((item) => item.trim().toLowerCase()).filter(Boolean))]
}

function toggleCapability(capabilities: string[], capability: string): string[] {
  return capabilities.includes(capability)
    ? capabilities.filter((item) => item !== capability)
    : [...capabilities, capability]
}

function formatModelOption(model: ProviderRemoteModel): string {
  return model.displayName && model.displayName !== model.modelId
    ? `${model.displayName} (${model.modelId})`
    : model.modelId
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return <>{text}</>

  const start = text.toLowerCase().indexOf(normalizedQuery)
  if (start === -1) return <>{text}</>

  const end = start + normalizedQuery.length
  return (
    <>
      {text.slice(0, start)}
      <span className="rounded bg-primary/15 text-primary">{text.slice(start, end)}</span>
      {text.slice(end)}
    </>
  )
}

function CapabilitySwitches({
  value,
  onChange,
  t,
}: {
  value: string[]
  onChange: (next: string[]) => void
  t: Translate
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {CAPABILITY_OPTIONS.map((capability) => {
        const selected = value.includes(capability.value)
        const Icon = capability.icon
        return (
          <label
            key={capability.value}
            className={cn(
              'flex min-h-10 items-center justify-between gap-3 rounded border px-3 py-2 transition-colors',
              selected ? 'border-primary bg-primary/10' : 'border-border bg-muted/20',
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded',
                  CAP_COLORS[capability.value],
                )}
              >
                <Icon size={13} />
              </span>
              <span className="truncate font-mono text-[11px]">{t(capability.labelKey)}</span>
            </span>
            <Switch
              checked={selected}
              onCheckedChange={() => onChange(toggleCapability(value, capability.value))}
            />
          </label>
        )
      })}
    </div>
  )
}

function CapabilityIcons({ capabilities, t }: { capabilities: string[]; t: Translate }) {
  const knownCapabilities = capabilities
    .map((capability) => CAPABILITY_OPTIONS.find((item) => item.value === capability))
    .filter((item): item is (typeof CAPABILITY_OPTIONS)[number] => Boolean(item))

  if (knownCapabilities.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {knownCapabilities.map((capability) => {
        const Icon = capability.icon
        return (
          <span
            key={capability.value}
            title={t(capability.labelKey)}
            aria-label={t(capability.labelKey)}
            className={cn(
              'flex size-6 items-center justify-center rounded border border-border/60',
              CAP_COLORS[capability.value],
            )}
          >
            <Icon size={13} />
          </span>
        )
      })}
    </div>
  )
}

/* ── Add Provider Form ─────────────────────────────────── */

function AddProviderForm({
  templates,
  onClose,
  onCreated,
  t,
}: {
  templates: ProviderTemplate[]
  onClose: () => void
  onCreated: () => void
  t: Translate
}) {
  const [kind, setKind] = useState('')
  const [apiFormat, setApiFormat] = useState('')
  const [name, setName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = templates.find((t) => t.kind === kind)

  function handleKindChange(nextKind: string) {
    setKind(nextKind)
    const tpl = templates.find((t) => t.kind === nextKind)
    if (tpl) {
      setName(tpl.label)
      setBaseUrl(tpl.defaultBaseUrl)
      setApiFormat(tpl.defaultApiFormat)
    } else {
      setName('')
      setBaseUrl('')
      setApiFormat('')
    }
  }

  function handleApiFormatChange(nextApiFormat: string) {
    setApiFormat(nextApiFormat)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.createProvider({ name, kind, apiFormat, baseUrl, apiKey })
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.failedToCreateProvider'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <CardPanel className="mb-4">
      <CardPanelHeader
        icon={ServerCog}
        title={t('settings.addProvider')}
        action={{ label: <X size={14} />, onClick: onClose }}
      />
      <CardPanelBody className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Template selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {t('settings.vendor')}
            </Label>
            <Select value={kind || undefined} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue placeholder={t('settings.selectVendor')} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.kind} value={t.kind}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected?.hint && (
              <p className="text-[10px] font-mono text-muted-foreground">
                {t('settings.getApiKey')}: {selected.hint}
              </p>
            )}
          </div>

          {kind && (
            <>
              {/* Name */}
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {t('settings.name')}
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('settings.providerNamePlaceholder')}
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {t('settings.apiFormat')}
                  </Label>
                  <Select value={apiFormat || undefined} onValueChange={handleApiFormatChange}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('settings.selectApiFormat')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(selected?.apiFormats ?? []).map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Base URL */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  {t('settings.baseUrl')}
                </Label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono text-xs"
                  required
                />
              </div>

              {/* API Key */}
              {kind !== 'ollama' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    {t('settings.apiKey')}
                  </Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="font-mono text-xs"
                    required
                  />
                </div>
              )}

              {error && <p className="text-xs font-mono text-red-400">{error}</p>}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  variant="accent-outline"
                  size="sm"
                  disabled={loading}
                  className="font-mono gap-1.5"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  {t('settings.create')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="font-mono text-muted-foreground"
                >
                  {t('settings.cancel')}
                </Button>
              </div>
            </>
          )}
        </form>
      </CardPanelBody>
    </CardPanel>
  )
}

/* ── Edit Provider Form ───────────────────────────────── */

function EditProviderForm({
  provider,
  template,
  onCancel,
  onSaved,
  t,
}: {
  provider: Provider
  template?: ProviderTemplate
  onCancel: () => void
  onSaved: () => void
  t: Translate
}) {
  const [name, setName] = useState(provider.name)
  const [apiFormat, setApiFormat] = useState(provider.apiFormat)
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl)
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const apiFormats = template?.apiFormats?.length ? template.apiFormats : FALLBACK_API_FORMATS

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.updateProvider(provider.id, {
        name,
        apiFormat,
        baseUrl,
        apiKey: apiKey || undefined,
      })
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.failedToUpdateProvider'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 border-b border-border/50 bg-muted/20 px-4 py-3"
    >
      <div className="grid gap-2 lg:grid-cols-[1fr_220px_1.5fr_1fr]">
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">
            {t('settings.name')}
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 font-mono text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">
            {t('settings.apiFormat')}
          </Label>
          <Select value={apiFormat} onValueChange={setApiFormat}>
            <SelectTrigger className="h-8 font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {apiFormats.map((format) => (
                <SelectItem key={format.value} value={format.value}>
                  {format.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">
            {t('settings.baseUrl')}
          </Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="h-8 font-mono text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">
            {t('settings.newApiKey')}
          </Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t('settings.leaveUnchanged')}
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>
      {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="accent-outline"
          size="sm"
          disabled={loading}
          className="h-7 gap-1.5 font-mono text-[11px]"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          {t('settings.saveProvider')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 font-mono text-[11px] text-muted-foreground"
        >
          {t('settings.cancel')}
        </Button>
      </div>
    </form>
  )
}

/* ── Model Form Dialogs ───────────────────────────────── */

interface ModelFormFieldsProps {
  t: Translate
  modelId?: string
  modelIdReadOnly?: boolean
  displayName: string
  maxTokens: string
  capabilities: string[]
  onModelIdChange?: (value: string) => void
  onDisplayNameChange: (value: string) => void
  onMaxTokensChange: (value: string) => void
  onCapabilitiesChange: (value: string[]) => void
}

function ModelFormFields({
  t,
  modelId = '',
  modelIdReadOnly = false,
  displayName,
  maxTokens,
  capabilities,
  onModelIdChange,
  onDisplayNameChange,
  onMaxTokensChange,
  onCapabilitiesChange,
}: ModelFormFieldsProps) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {t('settings.modelId')}
          </Label>
          <Input
            value={modelId}
            onChange={(e) => onModelIdChange?.(e.target.value)}
            readOnly={modelIdReadOnly}
            placeholder="deepseek-v4-pro"
            className="h-8 font-mono text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {t('settings.maxTokens')}
          </Label>
          <Input
            type="number"
            value={maxTokens}
            onChange={(e) => onMaxTokensChange(e.target.value)}
            placeholder="16384"
            className="h-8 font-mono text-xs"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('settings.displayName')}
        </Label>
        <Input
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="DeepSeek V4 Pro"
          className="h-8 font-mono text-xs"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t('settings.capabilities')}
        </Label>
        <CapabilitySwitches value={capabilities} onChange={onCapabilitiesChange} t={t} />
      </div>
    </div>
  )
}

function AddModelDialog({
  open,
  providerId,
  onOpenChange,
  onAdded,
  t,
}: {
  open: boolean
  providerId: string
  onOpenChange: (open: boolean) => void
  onAdded: () => void
  t: Translate
}) {
  const [modelId, setModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) return
    setModelId('')
    setDisplayName('')
    setMaxTokens('')
    setCapabilities([])
    setError('')
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.addProviderModel(providerId, {
        modelId,
        displayName: displayName || undefined,
        maxTokens: maxTokens ? Number(maxTokens) : undefined,
        capabilities: capabilities.length ? capabilities : undefined,
      })
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.failedToAddModel'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('settings.addModel')}</DialogTitle>
            <DialogDescription>{t('settings.addModelDescription')}</DialogDescription>
          </DialogHeader>
          <ModelFormFields
            t={t}
            modelId={modelId}
            displayName={displayName}
            maxTokens={maxTokens}
            capabilities={capabilities}
            onModelIdChange={setModelId}
            onDisplayNameChange={setDisplayName}
            onMaxTokensChange={setMaxTokens}
            onCapabilitiesChange={setCapabilities}
          />
          {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="font-mono text-muted-foreground"
            >
              {t('settings.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent-outline"
              size="sm"
              disabled={loading}
              className="font-mono gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {t('settings.addModel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditModelDialog({
  open,
  model,
  providerId,
  onOpenChange,
  onSaved,
  t,
}: {
  open: boolean
  model: ProviderModel
  providerId: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  t: Translate
}) {
  const [displayName, setDisplayName] = useState(model.displayName ?? '')
  const [maxTokens, setMaxTokens] = useState(model.maxTokens?.toString() ?? '')
  const [capabilities, setCapabilities] = useState(() => normalizeCapabilities(model.capabilities))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.updateProviderModel(providerId, model.modelId, {
        displayName: displayName || null,
        maxTokens: maxTokens ? Number(maxTokens) : null,
        capabilities,
      })
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('settings.failedToUpdateModel'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('settings.configureModel')}</DialogTitle>
            <DialogDescription>{t('settings.configureModelDescription')}</DialogDescription>
          </DialogHeader>
          <ModelFormFields
            t={t}
            modelId={model.modelId}
            modelIdReadOnly
            displayName={displayName}
            maxTokens={maxTokens}
            capabilities={capabilities}
            onDisplayNameChange={setDisplayName}
            onMaxTokensChange={setMaxTokens}
            onCapabilitiesChange={setCapabilities}
          />
          {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="font-mono text-muted-foreground"
            >
              {t('settings.cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent-outline"
              size="sm"
              disabled={loading}
              className="font-mono gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {t('settings.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/* ── Provider Card ─────────────────────────────────────── */

function ProviderCard({
  provider,
  templates,
  onRefresh,
  onModelsChanged,
  t,
}: {
  provider: Provider
  templates: ProviderTemplate[]
  onRefresh: () => void
  onModelsChanged: () => void
  t: Translate
}) {
  const [models, setModels] = useState<ProviderModel[]>([])
  const [remoteModels, setRemoteModels] = useState<ProviderRemoteModel[]>([])
  const [remoteModelsLoaded, setRemoteModelsLoaded] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [editingProvider, setEditingProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [addingModelId, setAddingModelId] = useState<string | null>(null)
  const [addModelPickerOpen, setAddModelPickerOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null)
  const [modelActionError, setModelActionError] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmDeleteProviderOpen, setConfirmDeleteProviderOpen] = useState(false)
  const [pendingDeleteModel, setPendingDeleteModel] = useState<ProviderModel | null>(null)

  const loadModels = useCallback(async () => {
    try {
      const data = await api.getProvider(provider.id)
      setModels(data.models)
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }, [provider.id])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  useEffect(() => {
    setRemoteModels([])
    setRemoteModelsLoaded(false)
    setModelActionError('')
    setModelSearch('')
  }, [provider.baseUrl, provider.apiFormat, provider.kind])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testProvider(provider.id)
      setTestResult(result)
    } catch (err: unknown) {
      setTestResult({ error: err instanceof Error ? err.message : t('settings.connectionFailed') })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await api.deleteProvider(provider.id)
      setConfirmDeleteProviderOpen(false)
      onRefresh()
    } catch {
      setDeleting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setModelActionError('')
    try {
      const result = await api.syncProvider(provider.id)
      setRemoteModels(result.models)
      setRemoteModelsLoaded(true)
    } catch (err: unknown) {
      setRemoteModels([])
      setRemoteModelsLoaded(true)
      setModelActionError(err instanceof Error ? err.message : t('settings.failedToFetchModels'))
    } finally {
      setSyncing(false)
    }
  }

  async function handleAddModelOption(value: string) {
    setAddModelPickerOpen(false)
    setModelSearch('')

    if (value === MANUAL_MODEL_OPTION) {
      setShowAddModel(true)
      return
    }

    const model = remoteModels.find((item) => item.modelId === value)
    if (!model) return

    setAddingModelId(value)
    setModelActionError('')
    try {
      await api.addProviderModel(provider.id, {
        modelId: model.modelId,
        displayName: model.displayName,
        maxTokens: model.maxTokens,
        capabilities: model.capabilities,
      })
      setRemoteModels((prev) => prev.filter((item) => item.modelId !== model.modelId))
      await loadModels()
      onModelsChanged()
    } catch (err: unknown) {
      setModelActionError(err instanceof Error ? err.message : t('settings.failedToAddModel'))
    } finally {
      setAddingModelId(null)
    }
  }

  async function handleToggleModel(model: ProviderModel) {
    try {
      await api.updateProviderModel(provider.id, model.modelId, { enabled: !model.enabled })
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, enabled: !m.enabled } : m)))
      onModelsChanged()
    } catch {
      // silent
    }
  }

  async function handleDeleteModel(model: ProviderModel) {
    setDeletingModelId(model.modelId)
    setModelActionError('')
    try {
      await api.deleteProviderModel(provider.id, model.modelId)
      setModels((prev) => prev.filter((item) => item.id !== model.id))
      setPendingDeleteModel(null)
      onModelsChanged()
    } catch (err: unknown) {
      setModelActionError(err instanceof Error ? err.message : t('settings.failedToDeleteModel'))
    } finally {
      setDeletingModelId(null)
    }
  }

  const enabledCount = models.filter((m) => m.enabled).length
  const embeddingCount = models.filter(
    (m) => m.enabled && m.capabilities.includes('embedding'),
  ).length
  const template = templates.find((item) => item.kind === provider.kind)
  const editingModel = models.find((model) => model.id === editingModelId) ?? null
  const existingModelIds = new Set(models.map((model) => model.modelId))
  const availableRemoteModels = remoteModels.filter((model) => !existingModelIds.has(model.modelId))
  const normalizedModelSearch = modelSearch.trim().toLowerCase()
  const filteredRemoteModels = normalizedModelSearch
    ? availableRemoteModels.filter((model) =>
        formatModelOption(model).toLowerCase().includes(normalizedModelSearch),
      )
    : availableRemoteModels

  return (
    <CardPanel className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          <IconBox size="md">
            <ServerCog size={14} className="text-muted-foreground" />
          </IconBox>
          <span className="text-sm font-medium truncate">{provider.name}</span>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
            {provider.kind}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">
            {API_FORMAT_LABELS[provider.apiFormat] ?? provider.apiFormat}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground truncate hidden sm:inline">
            {provider.baseUrl}
          </span>
          {loaded && (
            <>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t('settings.modelsEnabledCount')
                  .replace('{enabled}', String(enabledCount))
                  .replace('{total}', String(models.length))}
              </span>
              {embeddingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] text-amber-400 bg-amber-400/10"
                >
                  {t('settings.embeddingCount').replace('{count}', String(embeddingCount))}
                </Badge>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Test result */}
          {testResult && (
            <StatusBadge
              status={testResult.ok ? 'success' : 'error'}
              label={
                testResult.ok
                  ? t('settings.connectedModelCount').replace(
                      '{count}',
                      String(testResult.modelCount),
                    )
                  : (testResult.error ?? t('settings.failed'))
              }
            />
          )}
          <Button
            variant="accent-outline"
            size="sm"
            onClick={handleTest}
            disabled={testing}
            className="font-mono gap-1.5 h-7 text-[11px]"
          >
            {testing ? <Loader2 size={10} className="animate-spin" /> : <Zap size={10} />}
            {t('settings.test')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setExpanded(true)
              setEditingProvider((v) => !v)
            }}
            className="text-muted-foreground"
          >
            <Pencil size={12} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setConfirmDeleteProviderOpen(true)}
            disabled={deleting}
            className="text-muted-foreground hover:text-red-400"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </Button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <CardPanelBody>
          {editingProvider && (
            <EditProviderForm
              provider={provider}
              template={template}
              onCancel={() => setEditingProvider(false)}
              onSaved={() => {
                setEditingProvider(false)
                onRefresh()
              }}
              t={t}
            />
          )}

          {!loaded ? (
            <div className="px-4 py-8 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : models.length === 0 ? (
            <Empty className="py-6 border-0">
              <EmptyMedia variant="icon">
                <Bot size={20} />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-mono">{t('settings.noModelsYet')}</EmptyTitle>
            </Empty>
          ) : (
            <div className="max-h-[360px] overflow-y-auto">
              {models.map((model) => (
                <DataRow
                  key={model.id}
                  className={cn(!model.enabled && 'opacity-50')}
                  leading={
                    <button
                      onClick={() => handleToggleModel(model)}
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0',
                        model.enabled
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-transparent text-transparent',
                      )}
                    >
                      {model.enabled && <Check size={10} />}
                    </button>
                  }
                  trailing={
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        onClick={() => setEditingModelId(model.id)}
                      >
                        <Pencil size={10} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground hover:text-red-400"
                        onClick={() => setPendingDeleteModel(model)}
                        disabled={deletingModelId === model.modelId}
                      >
                        {deletingModelId === model.modelId ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <Trash2 size={10} />
                        )}
                      </Button>
                    </div>
                  }
                >
                  <div className="grid min-w-0 gap-1 md:grid-cols-[minmax(0,1.4fr)_auto_minmax(160px,0.8fr)] md:items-center">
                    <div className="min-w-0">
                      <div className="font-mono text-xs truncate">
                        {model.displayName ?? model.modelId}
                      </div>
                      {model.displayName && (
                        <div className="font-mono text-[10px] text-muted-foreground truncate">
                          {model.modelId}
                        </div>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {model.maxTokens
                        ? t('settings.tokensCount').replace(
                            '{count}',
                            model.maxTokens.toLocaleString(),
                          )
                        : t('settings.tokensEmpty')}
                    </span>
                    <CapabilityIcons capabilities={model.capabilities} t={t} />
                  </div>
                </DataRow>
              ))}
            </div>
          )}

          {/* Footer actions */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-border/50">
            <Popover
              open={addModelPickerOpen}
              onOpenChange={(open) => {
                if (addingModelId) return
                setAddModelPickerOpen(open)
                if (!open) setModelSearch('')
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={Boolean(addingModelId)}
                  className="h-8 w-[260px] justify-between font-mono text-[11px] text-muted-foreground"
                >
                  {addingModelId ? t('settings.addingModel') : t('settings.addModel')}
                  <ChevronDown size={12} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px] p-0">
                <div className="border-b border-border/60 p-2">
                  <div className="relative">
                    <Search
                      size={12}
                      className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={modelSearch}
                      onChange={(event) => setModelSearch(event.target.value)}
                      placeholder={t('settings.searchModels')}
                      className="h-8 pl-7 font-mono text-[11px]"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-[260px] overflow-y-auto p-1">
                  {filteredRemoteModels.length > 0 ? (
                    filteredRemoteModels.map((model) => (
                      <button
                        key={model.modelId}
                        type="button"
                        onClick={() => handleAddModelOption(model.modelId)}
                        className="flex w-full items-center rounded px-2 py-1.5 text-left font-mono text-[11px] hover:bg-muted"
                      >
                        <span className="min-w-0 truncate">
                          <HighlightMatch text={formatModelOption(model)} query={modelSearch} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-6 text-center font-mono text-[11px] text-muted-foreground">
                      {t('settings.noModelsFound')}
                    </div>
                  )}
                  <Separator className="my-1" />
                  <button
                    type="button"
                    onClick={() => handleAddModelOption(MANUAL_MODEL_OPTION)}
                    className="flex w-full items-center rounded px-2 py-1.5 text-left font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {t('settings.enterModelManually')}
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[11px] gap-1.5 text-muted-foreground"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              {t('settings.fetchModels')}
            </Button>
            {remoteModelsLoaded && (
              <span className="font-mono text-[10px] text-muted-foreground">
                {t('settings.availableModelsCount')
                  .replace('{available}', String(availableRemoteModels.length))
                  .replace('{total}', String(remoteModels.length))}
              </span>
            )}
            {modelActionError && (
              <span className="font-mono text-[10px] text-red-400">{modelActionError}</span>
            )}
          </div>

          <AddModelDialog
            open={showAddModel}
            providerId={provider.id}
            onOpenChange={setShowAddModel}
            onAdded={() => {
              setShowAddModel(false)
              loadModels()
              onModelsChanged()
            }}
            t={t}
          />
          {editingModel && (
            <EditModelDialog
              open={editingModel !== null}
              model={editingModel}
              providerId={provider.id}
              onOpenChange={(open) => !open && setEditingModelId(null)}
              onSaved={() => {
                setEditingModelId(null)
                loadModels()
                onModelsChanged()
              }}
              t={t}
            />
          )}
          <ConfirmDialog
            open={pendingDeleteModel !== null}
            onOpenChange={(open) => !open && setPendingDeleteModel(null)}
            title={t('settings.deleteModelConfirm').replace(
              '{name}',
              pendingDeleteModel?.displayName ?? pendingDeleteModel?.modelId ?? '',
            )}
            description={t('settings.deleteModelDescription')}
            confirmLabel={t('settings.delete')}
            cancelLabel={t('settings.cancel')}
            loading={Boolean(pendingDeleteModel && deletingModelId === pendingDeleteModel.modelId)}
            onConfirm={() => {
              if (!pendingDeleteModel) return
              handleDeleteModel(pendingDeleteModel)
            }}
          />
        </CardPanelBody>
      )}
      <ConfirmDialog
        open={confirmDeleteProviderOpen}
        onOpenChange={(open) => !deleting && setConfirmDeleteProviderOpen(open)}
        title={t('settings.deleteProviderConfirm').replace('{name}', provider.name)}
        description={t('settings.deleteProviderDescription')}
        confirmLabel={t('settings.delete')}
        cancelLabel={t('settings.cancel')}
        loading={deleting}
        onConfirm={handleDelete}
      />
    </CardPanel>
  )
}

function DefaultModelsPanel({
  providers,
  refreshKey,
  t,
}: {
  providers: Provider[]
  refreshKey: number
  t: Translate
}) {
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

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [settingsRes, modelEntries] = await Promise.all([
        api.getModelSettings(),
        Promise.all(
          providers.map(async (provider) => {
            try {
              const res = await api.getProvider(provider.id)
              return [provider.id, res.models] as const
            } catch {
              return [provider.id, []] as const
            }
          }),
        ),
      ])
      setSettings(settingsRes.settings)
      setModelsByProviderId(Object.fromEntries(modelEntries))
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToLoadModelSettings'))
    } finally {
      setLoading(false)
    }
  }, [providers, refreshKey, t])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

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
    <section className="mb-4 space-y-4 rounded-md border border-border bg-muted/20 p-4">
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
            onChange={(compression) => setSettings((current) => ({ ...current, compression }))}
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
  )
}

/* ── Main Page ─────────────────────────────────────────── */

export default function ProvidersPage() {
  const { t } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [templates, setTemplates] = useState<ProviderTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [modelsRefreshKey, setModelsRefreshKey] = useState(0)

  const loadProviders = useCallback(async () => {
    try {
      const data = await api.listProviders()
      setProviders(data.providers)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProviders()
    api
      .listProviderTemplates()
      .then((d: { templates: ProviderTemplate[] }) => setTemplates(d.templates))
      .catch(() => {})
  }, [loadProviders])

  return (
    <div className="mx-auto max-w-[1400px] p-6">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconBox size="md" className="border-primary bg-primary/10" interactive={false}>
            <Route size={14} className="text-primary" />
          </IconBox>
          <div>
            <h1 className="text-xl font-semibold">{t('settings.providersTitle')}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {t('settings.providersDescription')}
            </p>
          </div>
        </div>
        <Button
          variant="accent-outline"
          size="sm"
          className="font-mono gap-1.5"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus size={14} />
          {t('settings.addProvider')}
        </Button>
      </div>

      {!loading && <DefaultModelsPanel providers={providers} refreshKey={modelsRefreshKey} t={t} />}

      {/* Add form */}
      {showAdd && (
        <AddProviderForm
          templates={templates}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            loadProviders()
          }}
          t={t}
        />
      )}

      {/* Content */}
      {loading ? (
        <CardPanel>
          <CardPanelBody className="p-12">
            <PageLoading
              label={t('settings.loadingProviders')}
              className="min-h-32 bg-transparent"
            />
          </CardPanelBody>
        </CardPanel>
      ) : providers.length === 0 ? (
        <CardPanel>
          <Empty className="border-0 p-12">
            <EmptyMedia variant="icon">
              <Bot size={20} />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-mono">
              {t('settings.noProvidersConfigured')}
            </EmptyTitle>
            <EmptyDescription className="font-mono text-xs">
              {t('settings.noProvidersDescription')}
            </EmptyDescription>
          </Empty>
        </CardPanel>
      ) : (
        providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            templates={templates}
            onRefresh={loadProviders}
            onModelsChanged={() => setModelsRefreshKey((value) => value + 1)}
            t={t}
          />
        ))
      )}
    </div>
  )
}
