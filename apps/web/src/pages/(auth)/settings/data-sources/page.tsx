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
  cn,
} from '@eous/ui'
import {
  Database,
  Plus,
  X,
  Trash2,
  Zap,
  Check,
  Loader2,
  Search,
  Tag,
} from 'lucide-react'

/* ── Types ─────────────────────────────────────────────── */

interface ConfigFieldSchema {
  key: string
  label: string
  type: 'text' | 'password' | 'select' | 'number' | 'boolean'
  required?: boolean
  placeholder?: string
  options?: { label: string; value: string }[]
  default?: unknown
}

interface DataSourceProvider {
  id: string
  name: string
  configSchema: ConfigFieldSchema[]
}

interface TrackedSymbol {
  id: string
  symbol: string
  name: string | null
  exchange: string | null
  type: string | null
}

interface DataSourceInstance {
  id: string
  name: string
  providerKind: string
  createdAt: string
}

interface DataSourceDetail extends DataSourceInstance {
  trackedSymbols: TrackedSymbol[]
}

interface SearchResult {
  symbol: string
  name: string
  exchange?: string
  type?: string
}

/* ── API helpers ───────────────────────────────────────── */

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

/* ── Dynamic Config Field ──────────────────────────────── */

function ConfigField({
  field,
  value,
  onChange,
}: {
  field: ConfigFieldSchema
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const id = `config-${field.key}`

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
      >
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {field.type === 'select' ? (
        <select
          id={id}
          value={String(value ?? '')}
          onChange={(e) => onChange(field.key, e.target.value)}
          className="w-full h-9 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          required={field.required}
        >
          <option value="" disabled>
            Select {field.label}…
          </option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : field.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.key, e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="font-mono text-xs text-muted-foreground">Enabled</span>
        </label>
      ) : (
        <Input
          id={id}
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) =>
            onChange(
              field.key,
              field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
            )
          }
          placeholder={field.placeholder}
          className="font-mono text-xs"
          required={field.required}
        />
      )}
    </div>
  )
}

/* ── Add Data Source Form ──────────────────────────────── */

function AddDataSourceForm({
  providers,
  onClose,
  onCreated,
}: {
  providers: DataSourceProvider[]
  onClose: () => void
  onCreated: () => void
}) {
  const [kind, setKind] = useState('')
  const [name, setName] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = providers.find((p) => p.id === kind)

  function handleKindChange(nextKind: string) {
    setKind(nextKind)
    const prov = providers.find((p) => p.id === nextKind)
    if (prov) {
      setName(prov.name)
      const defaults: Record<string, unknown> = {}
      for (const field of prov.configSchema) {
        defaults[field.key] = field.default ?? (field.type === 'boolean' ? false : '')
      }
      setConfig(defaults)
    } else {
      setName('')
      setConfig({})
    }
  }

  function handleConfigChange(key: string, value: unknown) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await apiFetch('/api/data-source-instances', {
        method: 'POST',
        body: JSON.stringify({ name, providerKind: kind, config }),
      })
      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create data source')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CardPanel className="mb-4">
      <CardPanelHeader
        icon={Plus}
        title="Add Data Source"
        action={{ label: <X size={14} />, onClick: onClose }}
      />
      <CardPanelBody className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Provider Type
            </Label>
            <select
              value={kind}
              onChange={(e) => handleKindChange(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>
                Select data source type…
              </option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {kind && selected && (
            <>
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My Data Source"
                  className="font-mono text-xs"
                  required
                />
              </div>

              {/* Dynamic config fields */}
              {selected.configSchema.map((field) => (
                <ConfigField
                  key={field.key}
                  field={field}
                  value={config[field.key]}
                  onChange={handleConfigChange}
                />
              ))}

              {error && (
                <p className="text-xs font-mono text-red-400">{error}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="submit"
                  variant="accent-outline"
                  size="sm"
                  disabled={loading}
                  className="font-mono gap-1.5"
                >
                  {loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
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

/* ── Symbol Search Form ────────────────────────────────── */

function SymbolSearchForm({
  instanceId,
  onAdded,
}: {
  instanceId: string
  onAdded: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setError('')
    setSearching(true)
    setResults([])
    try {
      const data = await apiFetch<{ results: SearchResult[] }>(
        `/api/data-source-instances/${instanceId}/search`,
        {
          method: 'POST',
          body: JSON.stringify({ query: query.trim() }),
        },
      )
      setResults(data.results)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleAddSymbol(result: SearchResult) {
    setAdding(result.symbol)
    try {
      await apiFetch(`/api/data-source-instances/${instanceId}/symbols`, {
        method: 'POST',
        body: JSON.stringify({
          symbol: result.symbol,
          name: result.name,
          exchange: result.exchange,
          type: result.type,
        }),
      })
      setResults((prev) => prev.filter((r) => r.symbol !== result.symbol))
      onAdded()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add symbol')
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="px-4 py-3 border-t border-border/50 space-y-3">
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={12}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbols…"
            className="font-mono text-xs h-8 pl-7"
          />
        </div>
        <Button
          type="submit"
          variant="accent-outline"
          size="sm"
          disabled={searching || !query.trim()}
          className="font-mono gap-1.5 h-8 text-[11px]"
        >
          {searching ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <Search size={10} />
          )}
          Search
        </Button>
      </form>

      {error && <p className="text-[10px] font-mono text-red-400">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {results.map((r) => (
            <DataRow
              key={r.symbol}
              trailing={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={adding === r.symbol}
                  onClick={() => handleAddSymbol(r)}
                  className="font-mono text-[11px] gap-1 h-6 text-muted-foreground hover:text-primary"
                >
                  {adding === r.symbol ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Plus size={10} />
                  )}
                  Add
                </Button>
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-medium">{r.symbol}</span>
                {r.name && (
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {r.name}
                  </span>
                )}
                {r.exchange && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {r.exchange}
                  </span>
                )}
                {r.type && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {r.type}
                  </span>
                )}
              </div>
            </DataRow>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Data Source Card ──────────────────────────────────── */

function DataSourceCard({
  instance,
  onRefresh,
}: {
  instance: DataSourceInstance
  onRefresh: () => void
}) {
  const [detail, setDetail] = useState<DataSourceDetail | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [removingSymbol, setRemovingSymbol] = useState<string | null>(null)

  const loadDetail = useCallback(async () => {
    try {
      const data = await apiFetch<DataSourceDetail>(
        `/api/data-source-instances/${instance.id}`,
      )
      setDetail(data)
      setLoaded(true)
    } catch {
      setLoaded(true)
    }
  }, [instance.id])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await apiFetch<{ ok: boolean; error?: string }>(
        `/api/data-source-instances/${instance.id}/test`,
        { method: 'POST' },
      )
      setTestResult(result)
    } catch (err: unknown) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : 'Connection failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete data source "${instance.name}"?`)) return
    setDeleting(true)
    try {
      await apiFetch(`/api/data-source-instances/${instance.id}`, {
        method: 'DELETE',
      })
      onRefresh()
    } catch {
      setDeleting(false)
    }
  }

  async function handleRemoveSymbol(symbolId: string) {
    setRemovingSymbol(symbolId)
    try {
      await apiFetch(
        `/api/data-source-instances/${instance.id}/symbols/${symbolId}`,
        { method: 'DELETE' },
      )
      await loadDetail()
    } catch {
      // silent
    } finally {
      setRemovingSymbol(null)
    }
  }

  const symbols = detail?.trackedSymbols ?? []

  return (
    <CardPanel className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Database size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{instance.name}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wider">
            {instance.providerKind}
          </span>
          {loaded && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {symbols.length} {symbols.length === 1 ? 'symbol' : 'symbols'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {testResult && (
            <StatusBadge
              status={testResult.ok ? 'success' : 'error'}
              label={testResult.ok ? 'Connected' : testResult.error ?? 'Failed'}
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
            {deleting ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
          </Button>
        </div>
      </div>

      {/* Body */}
      <CardPanelBody>
        {!loaded ? (
          <div className="px-4 py-8 text-center">
            <Loader2 size={16} className="animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : symbols.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground font-mono">
              No tracked symbols. Search and add symbols below.
            </p>
          </div>
        ) : (
          symbols.map((sym) => (
            <DataRow
              key={sym.id}
              trailing={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-red-400"
                  disabled={removingSymbol === sym.id}
                  onClick={() => handleRemoveSymbol(sym.id)}
                >
                  {removingSymbol === sym.id ? (
                    <Loader2 size={10} className="animate-spin" />
                  ) : (
                    <Trash2 size={10} />
                  )}
                </Button>
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono text-xs font-medium">{sym.symbol}</span>
                {sym.name && (
                  <span className="font-mono text-[10px] text-muted-foreground truncate">
                    {sym.name}
                  </span>
                )}
                {sym.exchange && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {sym.exchange}
                  </span>
                )}
                {sym.type && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                    {sym.type}
                  </span>
                )}
              </div>
            </DataRow>
          ))
        )}

        {/* Search to add symbols */}
        <SymbolSearchForm instanceId={instance.id} onAdded={loadDetail} />
      </CardPanelBody>
    </CardPanel>
  )
}

/* ── Main Page ─────────────────────────────────────────── */

export default function DataSourcesPage() {
  const [instances, setInstances] = useState<DataSourceInstance[]>([])
  const [providers, setProviders] = useState<DataSourceProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const loadInstances = useCallback(async () => {
    try {
      const data = await apiFetch<{ instances: DataSourceInstance[] }>(
        '/api/data-source-instances',
      )
      setInstances(data.instances)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
    apiFetch<{ providers: DataSourceProvider[] }>('/api/data-source-providers')
      .then((d) => setProviders(d.providers))
      .catch(() => {})
  }, [loadInstances])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Data Sources</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono text-xs">
            Manage market data providers and tracked symbols
          </p>
        </div>
        <Button
          variant="accent-outline"
          size="sm"
          className="font-mono gap-1.5"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus size={14} />
          Add Data Source
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddDataSourceForm
          providers={providers}
          onClose={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false)
            loadInstances()
          }}
        />
      )}

      {/* Content */}
      {loading ? (
        <CardPanel>
          <CardPanelBody className="p-12 text-center">
            <Loader2 size={20} className="animate-spin mx-auto text-muted-foreground" />
          </CardPanelBody>
        </CardPanel>
      ) : instances.length === 0 ? (
        <CardPanel>
          <CardPanelBody className="p-12 text-center">
            <Database size={32} className="mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground font-mono">
              No data sources configured.
            </p>
          </CardPanelBody>
        </CardPanel>
      ) : (
        instances.map((inst) => (
          <DataSourceCard key={inst.id} instance={inst} onRefresh={loadInstances} />
        ))
      )}
    </div>
  )
}
