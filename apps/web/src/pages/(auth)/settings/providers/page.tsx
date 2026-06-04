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
} from 'lucide-react'
import type { Provider, ProviderModel, ProviderTemplate, TestResult } from '@eous/types'
import { api } from '@/lib/api'

/* ── Capability color map ──────────────────────────────── */

const CAP_COLORS: Record<string, string> = {
  vision: 'text-purple-400 bg-purple-400/10',
  function_calling: 'text-blue-400 bg-blue-400/10',
  reasoning: 'text-orange-400 bg-orange-400/10',
  json_mode: 'text-cyan-400 bg-cyan-400/10',
  streaming: 'text-emerald-400 bg-emerald-400/10',
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
    } else {
      setName('')
      setBaseUrl('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.createProvider({ name, kind, baseUrl, apiKey })
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
        icon={Plus}
        title="Add Provider"
        action={{ label: <X size={14} />, onClick: onClose }}
      />
      <CardPanelBody className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Template selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Provider Type
            </Label>
            <Select value={kind || undefined} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider type…" />
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
              <div className="space-y-1.5">
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

              {/* Base URL */}
              <div className="space-y-1.5">
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
                <div className="space-y-1.5">
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

/* ── Add Model Inline Form ─────────────────────────────── */

function AddModelForm({
  providerId,
  onClose,
  onAdded,
}: {
  providerId: string
  onClose: () => void
  onAdded: () => void
}) {
  const [modelId, setModelId] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [maxTokens, setMaxTokens] = useState('')
  const [capsInput, setCapsInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const caps = capsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await api.addProviderModel(providerId, {
        modelId,
        displayName: displayName || undefined,
        maxTokens: maxTokens ? Number(maxTokens) : undefined,
        capabilities: caps.length ? caps : undefined,
      })
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-border/50 space-y-3">
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Model ID *</Label>
          <Input
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            placeholder="gpt-4o"
            className="font-mono text-xs h-8"
            required
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="GPT-4o"
            className="font-mono text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Max Tokens</Label>
          <Input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            placeholder="16384"
            className="font-mono text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Capabilities</Label>
          <Input
            value={capsInput}
            onChange={(e) => setCapsInput(e.target.value)}
            placeholder="vision, function_calling"
            className="font-mono text-xs h-8"
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
          className="font-mono gap-1.5 h-7 text-[11px]"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
          Add Model
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="font-mono text-muted-foreground h-7 text-[11px]"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ── Edit Model Inline Form ────────────────────────────── */

function EditModelForm({
  model,
  providerId,
  onClose,
  onSaved,
}: {
  model: ProviderModel
  providerId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [displayName, setDisplayName] = useState(model.displayName ?? '')
  const [maxTokens, setMaxTokens] = useState(model.maxTokens?.toString() ?? '')
  const [capsInput, setCapsInput] = useState(model.capabilities.join(', '))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const caps = capsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      await api.updateProviderModel(providerId, model.modelId, {
        displayName: displayName || null,
        maxTokens: maxTokens ? Number(maxTokens) : null,
        capabilities: caps,
      })
      onSaved()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update model')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 bg-muted/20 border-t border-border/50 space-y-3"
    >
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Display Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="font-mono text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">Max Tokens</Label>
          <Input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            className="font-mono text-xs h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-mono text-muted-foreground">
            Capabilities (comma-separated)
          </Label>
          <Input
            value={capsInput}
            onChange={(e) => setCapsInput(e.target.value)}
            className="font-mono text-xs h-8"
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
          className="font-mono gap-1.5 h-7 text-[11px]"
        >
          {loading ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="font-mono text-muted-foreground h-7 text-[11px]"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

/* ── Provider Card ─────────────────────────────────────── */

function ProviderCard({ provider, onRefresh }: { provider: Provider; onRefresh: () => void }) {
  const [models, setModels] = useState<ProviderModel[]>([])
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(true)
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

  return (
    <CardPanel className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
          <Bot size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{provider.name}</span>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
            {provider.kind}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground truncate hidden sm:inline">
            {provider.baseUrl}
          </span>
          {loaded && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {enabledCount}/{models.length} models
            </span>
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
            size="icon"
            onClick={handleDelete}
            disabled={deleting}
            className="h-7 w-7 text-muted-foreground hover:text-red-400"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </Button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <CardPanelBody>
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
              <div key={model.id}>
                <DataRow
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
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                      onClick={() =>
                        setEditingModelId((prev) => (prev === model.id ? null : model.id))
                      }
                    >
                      <Pencil size={10} />
                    </Button>
                  }
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs truncate">
                      {model.displayName ?? model.modelId}
                    </span>
                    {model.displayName && (
                      <span className="font-mono text-[10px] text-muted-foreground truncate">
                        {model.modelId}
                      </span>
                    )}
                    {model.maxTokens && (
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {model.maxTokens.toLocaleString()} tokens
                      </span>
                    )}
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
                  </div>
                </DataRow>
                {editingModelId === model.id && (
                  <EditModelForm
                    model={model}
                    providerId={provider.id}
                    onClose={() => setEditingModelId(null)}
                    onSaved={() => {
                      setEditingModelId(null)
                      loadModels()
                    }}
                  />
                )}
              </div>
            ))
          )}

          {/* Footer actions */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="font-mono text-[11px] gap-1.5 text-muted-foreground"
              onClick={() => setShowAddModel((v) => !v)}
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

          {showAddModel && (
            <AddModelForm
              providerId={provider.id}
              onClose={() => setShowAddModel(false)}
              onAdded={() => {
                setShowAddModel(false)
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
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Providers</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono text-xs">
            Manage AI model providers and their models
          </p>
        </div>
        <Button
          variant="accent-outline"
          size="sm"
          className="font-mono gap-1.5"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus size={14} />
          Add Provider
        </Button>
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
          <CardPanelBody className="p-12 space-y-3">
            <Skeleton className="h-5 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </CardPanelBody>
        </CardPanel>
      ) : providers.length === 0 ? (
        <CardPanel>
          <Empty className="border-0 p-12">
            <EmptyMedia variant="icon">
              <Bot size={20} />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-mono">No providers configured</EmptyTitle>
            <EmptyDescription className="font-mono text-xs">
              Add your first provider to enable AI features.
            </EmptyDescription>
          </Empty>
        </CardPanel>
      ) : (
        providers.map((p) => <ProviderCard key={p.id} provider={p} onRefresh={loadProviders} />)
      )}
    </div>
  )
}
