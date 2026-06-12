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
  Checkbox,
  Skeleton,
  Empty,
  EmptyMedia,
  EmptyTitle,
  cn,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
} from '@eous/ui'
import { Database, Plus, X, Trash2, Zap, Check, Loader2, Search, ChevronDown } from 'lucide-react'
import type {
  DataSourceInstance,
  SymbolSearchResult,
  ConfigFieldSchema,
  DataSourceProvider,
} from '@eous/types'
import { api } from '@/lib/api'

/* ── Dynamic Config Field ──────────────────────────────── */

function ConfigField({
  providerId,
  field,
  value,
  onChange,
}: {
  providerId: string
  field: ConfigFieldSchema
  value: unknown
  onChange: (key: string, value: unknown) => void
}) {
  const [dynamicOptions, setDynamicOptions] = useState<{ label: string; value: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [optionsQuery, setOptionsQuery] = useState('')

  const id = `config-${field.key}`
  const options = field.optionsSource ? dynamicOptions : (field.options ?? [])
  const usesSearchableSelect =
    field.type === 'select' && (field.optionsSource || (field.options?.length ?? 0) > 50)
  const filteredOptions = field.optionsSource
    ? options
    : options.filter((opt) => {
        const q = optionsQuery.trim().toLowerCase()
        if (!q) return true
        return opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
      })
  const selectedOption = options.find((opt) => opt.value === String(value ?? ''))
  const displayValue = selectedOption?.label ?? String(value ?? '')

  useEffect(() => {
    if (!field.optionsSource || !comboboxOpen) return

    let cancelled = false
    setOptionsLoading(true)

    const timer = window.setTimeout(
      () => {
        api
          .getDataSourceProviderOptions(providerId, field.key, optionsQuery)
          .then((res) => {
            if (!cancelled) setDynamicOptions(res.options)
          })
          .catch(() => {
            if (!cancelled) setDynamicOptions([])
          })
          .finally(() => {
            if (!cancelled) setOptionsLoading(false)
          })
      },
      optionsQuery ? 150 : 0,
    )

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [comboboxOpen, field.key, field.optionsSource, optionsQuery, providerId])

  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
      >
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </Label>
      {usesSearchableSelect ? (
        <Popover
          open={comboboxOpen}
          onOpenChange={(open) => {
            setComboboxOpen(open)
            if (open) setOptionsQuery('')
          }}
        >
          <PopoverTrigger asChild>
            <button
              id={id}
              type="button"
              className={cn(
                'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow]',
                'hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
                !displayValue && 'text-muted-foreground',
              )}
            >
              <span className="truncate font-mono text-xs">
                {displayValue || `Select ${field.label}…`}
              </span>
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
            align="start"
          >
            <div className="flex items-center border-b border-border px-2">
              <Search size={12} className="shrink-0 text-muted-foreground" />
              <input
                className="h-8 w-full bg-transparent px-2 font-mono text-xs outline-none placeholder:text-muted-foreground"
                placeholder={`Search ${field.label}…`}
                value={optionsQuery}
                onChange={(e) => setOptionsQuery(e.target.value)}
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-64">
              <div className="p-1">
                {optionsLoading ? (
                  <div className="flex items-center justify-center gap-1.5 px-2 py-3 font-mono text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    Loading options…
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-2 py-3 text-center font-mono text-xs text-muted-foreground">
                    No options
                  </div>
                ) : (
                  filteredOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left font-mono text-xs hover:bg-accent/50',
                        String(value ?? '') === opt.value && 'bg-accent',
                      )}
                      onClick={() => {
                        onChange(field.key, opt.value)
                        setComboboxOpen(false)
                        setOptionsQuery('')
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {String(value ?? '') === opt.value && (
                        <Check size={12} className="shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ) : field.type === 'select' ? (
        <Select
          value={String(value ?? '') || undefined}
          onValueChange={(v) => onChange(field.key, v)}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder={`Select ${field.label}…`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === 'boolean' ? (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            id={id}
            checked={!!value}
            onCheckedChange={(checked) => onChange(field.key, checked)}
          />
          <span className="font-mono text-xs text-muted-foreground">Enabled</span>
        </label>
      ) : (
        <Input
          id={id}
          type={
            field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
          }
          value={String(value ?? '')}
          onChange={(e) =>
            onChange(
              field.key,
              field.type === 'number'
                ? e.target.value === ''
                  ? ''
                  : Number(e.target.value)
                : e.target.value,
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
  const [defaultSymbol, setDefaultSymbol] = useState('')
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = providers.find((p) => p.id === kind)

  function handleKindChange(nextKind: string) {
    setKind(nextKind)
    const prov = providers.find((p) => p.id === nextKind)
    if (prov) {
      setName(prov.name)
      setDefaultSymbol(nextKind === 'ccxt' ? 'BTC/USDT' : 'AAPL')
      const defaults: Record<string, unknown> = {}
      for (const field of prov.configSchema) {
        defaults[field.key] = field.defaultValue ?? (field.type === 'boolean' ? false : '')
      }
      setConfig(defaults)
    } else {
      setName('')
      setDefaultSymbol('')
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
      await api.createDataSourceInstance({
        name,
        providerKind: kind,
        defaultSymbol: defaultSymbol.trim(),
        config,
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
            <Select value={kind || undefined} onValueChange={handleKindChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select data source type…" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  providerId={selected.id}
                  field={field}
                  value={config[field.key]}
                  onChange={handleConfigChange}
                />
              ))}

              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Default Symbol<span className="text-red-400 ml-0.5">*</span>
                </Label>
                <Input
                  value={defaultSymbol}
                  onChange={(e) => setDefaultSymbol(e.target.value)}
                  placeholder={kind === 'ccxt' ? 'BTC/USDT' : 'AAPL'}
                  className="font-mono text-xs"
                  required
                />
              </div>

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

/* ── Symbol Search Form ────────────────────────────────── */

function SymbolSearchForm({ instanceId, onAdded }: { instanceId: string; onAdded: () => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SymbolSearchResult[]>([])
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
      const data = await api.getDataSourceInstanceSymbols(instanceId, query.trim())
      setResults(data.symbols)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setSearching(false)
    }
  }

  async function handleAddSymbol(result: SymbolSearchResult) {
    setAdding(result.symbol)
    try {
      await api.addDataSourceSymbol(instanceId, {
        symbol: result.symbol,
        name: result.name,
        exchange: result.exchange,
        type: result.type,
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
          {searching ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
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
                  <Badge
                    variant="secondary"
                    className="font-mono text-[9px] px-1.5 py-0.5 shrink-0"
                  >
                    {r.exchange}
                  </Badge>
                )}
                {r.type && (
                  <Badge
                    variant="secondary"
                    className="font-mono text-[9px] px-1.5 py-0.5 shrink-0"
                  >
                    {r.type}
                  </Badge>
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
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.testDataSourceInstance(instance.id)
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
      await api.deleteDataSourceInstance(instance.id)
      onRefresh()
    } catch {
      setDeleting(false)
    }
  }

  return (
    <CardPanel className="mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Database size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{instance.name}</span>
          <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
            {instance.identityLabel || instance.providerKind}
          </Badge>
          <Badge variant="secondary" className="font-mono text-[10px]">
            Default {instance.defaultSymbol}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {testResult && (
            <StatusBadge
              status={testResult.ok ? 'success' : 'error'}
              label={testResult.ok ? 'Connected' : (testResult.error ?? 'Failed')}
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
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground hover:text-red-400"
          >
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </Button>
        </div>
      </div>
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
      const data = await api.listDataSourceInstances()
      setInstances(data.instances)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInstances()
    api.listDataSourceProviders().then((res) => setProviders(res.providers))
  }, [loadInstances])

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Data Sources</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
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
          <CardPanelBody className="p-12 space-y-3">
            <Skeleton className="h-5 w-1/3 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </CardPanelBody>
        </CardPanel>
      ) : instances.length === 0 ? (
        <CardPanel>
          <Empty className="border-0 p-12">
            <EmptyMedia variant="icon">
              <Database size={20} />
            </EmptyMedia>
            <EmptyTitle className="text-sm font-mono">No data sources configured</EmptyTitle>
          </Empty>
        </CardPanel>
      ) : (
        instances.map((inst) => (
          <DataSourceCard key={inst.id} instance={inst} onRefresh={loadInstances} />
        ))
      )}
    </div>
  )
}
