import { useState, useEffect, useCallback } from 'react'
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
} from '@eous/ui'
import {
  Bot,
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
  KeyRound,
  Route,
} from 'lucide-react'
import type { Provider, ProviderModel, ProviderTemplate, TestResult } from '@eous/api-client'
import { api } from '@/lib/api'
import { PageLoading } from '../../../../components/PageLoading'
import { useI18n } from '../../../../lib/i18n'

/* ── Capability color map ──────────────────────────────── */

const CAP_COLORS: Record<string, string> = {
  vision: 'text-purple-400 bg-purple-400/10',
  reasoning: 'text-orange-400 bg-orange-400/10',
  embedding: 'text-amber-400 bg-amber-400/10',
}

const CAPABILITY_OPTIONS = [
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'vision', label: 'Vision' },
  { value: 'embedding', label: 'Embedding' },
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

function normalizeCapabilities(input: string[]): string[] {
  return [...new Set(input.map((item) => item.trim().toLowerCase()).filter(Boolean))]
}

function toggleCapability(capabilities: string[], capability: string): string[] {
  return capabilities.includes(capability)
    ? capabilities.filter((item) => item !== capability)
    : [...capabilities, capability]
}

function CapabilityPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CAPABILITY_OPTIONS.map((capability) => {
        const selected = value.includes(capability.value)
        return (
          <button
            key={capability.value}
            type="button"
            onClick={() => onChange(toggleCapability(value, capability.value))}
            className={cn(
              'rounded border px-2 py-1 font-mono text-[10px] transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {capability.label}
          </button>
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
}: {
  templates: ProviderTemplate[]
  onClose: () => void
  onCreated: () => void
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
      setError(err instanceof Error ? err.message : 'Failed to create provider')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CardPanel className="mb-4">
      <CardPanelHeader
        icon={ServerCog}
        title="Add Provider"
        action={{ label: <X size={14} />, onClick: onClose }}
      />
      <CardPanelBody className="p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Template selector */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Vendor
            </Label>
            <Select value={kind || undefined} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor..." />
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
                Get API key: {selected.hint}
              </p>
            )}
          </div>

          {kind && (
            <>
              {/* Name */}
              <div className="grid gap-3 md:grid-cols-[1fr_220px]">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My Provider"
                    className="font-mono text-xs"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    API Format
                  </Label>
                  <Select value={apiFormat || undefined} onValueChange={handleApiFormatChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select API format…" />
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
                  Base URL
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
                    API Key
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
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="font-mono text-muted-foreground"
                >
                  Cancel
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
}: {
  provider: Provider
  template?: ProviderTemplate
  onCancel: () => void
  onSaved: () => void
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
      setError(err instanceof Error ? err.message : 'Failed to update provider')
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
          <Label className="text-[10px] font-mono text-muted-foreground">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 font-mono text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">API Format</Label>
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
          <Label className="text-[10px] font-mono text-muted-foreground">Base URL</Label>
          <Input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="h-8 font-mono text-xs"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-[10px] font-mono text-muted-foreground">New API Key</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Leave unchanged"
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
          Save Provider
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-7 font-mono text-[11px] text-muted-foreground"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ── Model Form Dialogs ───────────────────────────────── */

interface ModelFormFieldsProps {
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
            Model ID
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
            Max Tokens
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
          Display Name
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
          Capabilities
        </Label>
        <CapabilityPicker value={capabilities} onChange={onCapabilitiesChange} />
      </div>
    </div>
  )
}

function AddModelDialog({
  open,
  providerId,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  providerId: string
  onOpenChange: (open: boolean) => void
  onAdded: () => void
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
      setError(err instanceof Error ? err.message : 'Failed to add model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add model</DialogTitle>
            <DialogDescription>
              Add a chat, vision, reasoning, or embedding model under this provider.
            </DialogDescription>
          </DialogHeader>
          <ModelFormFields
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent-outline"
              size="sm"
              disabled={loading}
              className="font-mono gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Add Model
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
}: {
  open: boolean
  model: ProviderModel
  providerId: string
  onOpenChange: (open: boolean) => void
  onSaved: () => void
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
      setError(err instanceof Error ? err.message : 'Failed to update model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-[560px]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Configure model</DialogTitle>
            <DialogDescription>
              Update display metadata and enabled model capabilities.
            </DialogDescription>
          </DialogHeader>
          <ModelFormFields
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
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent-outline"
              size="sm"
              disabled={loading}
              className="font-mono gap-1.5"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
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
}: {
  provider: Provider
  templates: ProviderTemplate[]
  onRefresh: () => void
}) {
  const [models, setModels] = useState<ProviderModel[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const [editingProvider, setEditingProvider] = useState(false)
  const [showAddModel, setShowAddModel] = useState(false)
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [deleting, setDeleting] = useState(false)

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

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testProvider(provider.id)
      setTestResult(result)
    } catch (err: unknown) {
      setTestResult({ error: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete provider "${provider.name}"? This will also remove all its models.`))
      return
    setDeleting(true)
    try {
      await api.deleteProvider(provider.id)
      onRefresh()
    } catch {
      setDeleting(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      await api.syncProvider(provider.id)
      await loadModels()
    } catch {
      // silent
    } finally {
      setSyncing(false)
    }
  }

  async function handleToggleModel(model: ProviderModel) {
    try {
      await api.updateProviderModel(provider.id, model.modelId, { enabled: !model.enabled })
      setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, enabled: !m.enabled } : m)))
    } catch {
      // silent
    }
  }

  const enabledCount = models.filter((m) => m.enabled).length
  const embeddingCount = models.filter(
    (m) => m.enabled && m.capabilities.includes('embedding'),
  ).length
  const template = templates.find((item) => item.kind === provider.kind)
  const editingModel = models.find((model) => model.id === editingModelId) ?? null

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
                {enabledCount}/{models.length} models
              </span>
              {embeddingCount > 0 && (
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] text-amber-400 bg-amber-400/10"
                >
                  {embeddingCount} embedding
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
                  ? `Connected (${testResult.modelCount} models)`
                  : (testResult.error ?? 'Failed')
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
            Test
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
            onClick={handleDelete}
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
              <EmptyTitle className="text-sm font-mono">No models yet</EmptyTitle>
            </Empty>
          ) : (
            models.map((model) => (
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
                  <Button
                    variant="ghost"
                    size="xs"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                    onClick={() => setEditingModelId(model.id)}
                  >
                    <Pencil size={10} />
                  </Button>
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
                    {model.maxTokens ? `${model.maxTokens.toLocaleString()} tokens` : 'tokens -'}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {model.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className={cn(
                          'font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0',
                          CAP_COLORS[cap] ?? 'text-muted-foreground bg-muted',
                        )}
                      >
                        {cap}
                      </Badge>
                    ))}
                    {model.capabilities.length === 0 && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        no capabilities
                      </span>
                    )}
                  </div>
                </div>
              </DataRow>
            ))
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[11px] gap-1.5 text-muted-foreground"
              onClick={() => setShowAddModel(true)}
            >
              <Plus size={10} />
              Add model
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[11px] gap-1.5 text-muted-foreground"
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
              Sync from API
            </Button>
          </div>

          <AddModelDialog
            open={showAddModel}
            providerId={provider.id}
            onOpenChange={setShowAddModel}
            onAdded={() => {
              setShowAddModel(false)
              loadModels()
            }}
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
              }}
            />
          )}
        </CardPanelBody>
      )}
    </CardPanel>
  )
}

/* ── Main Page ─────────────────────────────────────────── */

export default function ProvidersPage() {
  const { t } = useI18n()
  const [providers, setProviders] = useState<Provider[]>([])
  const [templates, setTemplates] = useState<ProviderTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

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

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <CardPanel>
          <CardPanelBody className="flex items-center gap-3 p-3">
            <IconBox size="md">
              <ServerCog size={14} className="text-muted-foreground" />
            </IconBox>
            <div>
              <div className="text-sm font-medium">
                {t('settings.providersCount').replace('{count}', String(providers.length))}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {t('settings.customEndpointsSupported')}
              </div>
            </div>
          </CardPanelBody>
        </CardPanel>
        <CardPanel>
          <CardPanelBody className="flex items-center gap-3 p-3">
            <IconBox size="md">
              <Route size={14} className="text-muted-foreground" />
            </IconBox>
            <div>
              <div className="text-sm font-medium">{t('settings.apiFormatsCount')}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {t('settings.apiFormatsDescription')}
              </div>
            </div>
          </CardPanelBody>
        </CardPanel>
        <CardPanel>
          <CardPanelBody className="flex items-center gap-3 p-3">
            <IconBox size="md">
              <KeyRound size={14} className="text-muted-foreground" />
            </IconBox>
            <div>
              <div className="text-sm font-medium">{t('settings.encryptedKeys')}</div>
              <div className="font-mono text-[11px] text-muted-foreground">
                {t('settings.encryptedKeysDescription')}
              </div>
            </div>
          </CardPanelBody>
        </CardPanel>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddProviderForm
          templates={templates}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            loadProviders()
          }}
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
          <ProviderCard key={p.id} provider={p} templates={templates} onRefresh={loadProviders} />
        ))
      )}
    </div>
  )
}
