import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { Link, X, Loader2, Search } from 'lucide-react'
import {
  Input,
  Label,
  Badge,
  Checkbox,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
  cn,
} from '@eous/ui'
import type { ParamDef, OutputField, NodeDef } from '@eous/nodes'
import { sourceKline, sourcePrice, controlBranch } from '@eous/nodes'

const NODE_OUTPUTS: Record<string, Record<string, OutputField>> = {
  'source.kline': sourceKline.def.executeOutput,
  'source.price': sourcePrice.def.executeOutput,
  'control.branch': controlBranch.def.executeOutput,
}
import { useWorkflowStore } from '../../stores/workflow'
import { api } from '../../lib/api'
import { VariablePicker } from './variable-picker'
import type { VariableRef } from './variable-picker'
import type { Edge } from '@xyflow/react'

// ── Helpers ─────────────────────────────────────────────────

const VAR_PATTERN = /^{{(.+)}}$/

function isVariableRef(value: unknown): value is string {
  return typeof value === 'string' && VAR_PATTERN.test(value)
}

function parseVariableRef(value: string): VariableRef | null {
  const m = value.match(VAR_PATTERN)
  if (!m) return null
  const path = m[1]
  const dotIdx = path.indexOf('.')
  if (dotIdx === -1) return null
  return {
    nodeLabel: path.slice(0, dotIdx),
    fieldName: path.slice(dotIdx + 1),
    nodeId: '',
    fieldType: '',
  }
}

// ── Options loading hook ─────────────────────────────────────

interface SelectOption {
  label: string
  value: string
}

function useOptionsSource(
  fieldKey: string,
  optionsSource: ParamDef['optionsSource'],
  data: Record<string, unknown>,
  query?: string,
): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!optionsSource) return

    let cancelled = false
    const src = optionsSource

    async function load() {
      setLoading(true)
      try {
        if (src.source === 'dataSourceInstances') {
          const res = await api.listDataSourceInstances()
          if (!cancelled) {
            setOptions(
              res.instances.map((inst) => ({
                label: `${inst.name} (${inst.providerKind})`,
                value: inst.id,
              })),
            )
          }
        } else if (src.source === 'instanceSymbols') {
          const instanceId = data['dataSourceInstanceId']
          if (typeof instanceId === 'string' && instanceId) {
            const res = await api.getDataSourceInstanceSymbols(instanceId, query)
            if (!cancelled) {
              setOptions(
                res.symbols.map((s) => ({
                  label: s.name ? `${s.symbol} — ${s.name}` : s.symbol,
                  value: s.symbol,
                })),
              )
            }
          } else {
            if (!cancelled) setOptions([])
          }
        } else if (src.source === 'instanceIntervals') {
          const instanceId = data['dataSourceInstanceId']
          if (typeof instanceId === 'string' && instanceId) {
            const res = await api.getDataSourceInstanceIntervals(instanceId)
            if (!cancelled) {
              setOptions(res.intervals.map((i) => ({ label: i.label, value: i.value })))
            }
          } else {
            if (!cancelled) setOptions([])
          }
        }
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [optionsSource, data, query])

  return { options, loading }
}

// ── Single field renderer ─────────────────────────────────────

function ConfigField({
  fieldKey,
  param,
  nodeId,
  data,
  onChange,
  options,
  optionsLoading,
  upstreamOutputs,
  searchQuery,
  onSearchQueryChange,
}: {
  fieldKey: string
  param: ParamDef
  nodeId: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  options?: SelectOption[]
  optionsLoading?: boolean
  upstreamOutputs: Record<string, Record<string, unknown>>
  searchQuery?: string
  onSearchQueryChange?: (q: string) => void
}) {
  const [varPickerOpen, setVarPickerOpen] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const comboboxInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const rawValue = data[fieldKey]
  const hasVariable = isVariableRef(rawValue)
  const label = param.label ?? param.description ?? fieldKey
  const ui = param.ui ?? (param.type === 'number' ? 'number' : 'text')

  const handleValueChange = useCallback(
    (value: unknown) => {
      onChange({ ...data, [fieldKey]: value })
    },
    [data, fieldKey, onChange],
  )

  const handleVariableSelect = useCallback(
    (ref: VariableRef) => {
      const refStr = `{{${ref.nodeLabel}.${ref.fieldName}}}`

      if (ui === 'select' || ui === 'toggle') {
        onChange({ ...data, [fieldKey]: refStr })
        return
      }

      // For text/number/code: insert at cursor position
      const el = inputRef.current
      if (el && 'selectionStart' in el) {
        const start = el.selectionStart ?? 0
        const end = el.selectionEnd ?? 0
        const current = String(rawValue ?? '')
        const next = current.slice(0, start) + refStr + current.slice(end)
        onChange({ ...data, [fieldKey]: next })
        requestAnimationFrame(() => {
          el.focus()
          const pos = start + refStr.length
          el.setSelectionRange(pos, pos)
        })
      } else {
        onChange({ ...data, [fieldKey]: refStr })
      }
    },
    [data, fieldKey, onChange, rawValue, ui],
  )

  const handleClearVariable = useCallback(() => {
    onChange({ ...data, [fieldKey]: '' })
  }, [data, fieldKey, onChange])

  const hasSearch = !!onSearchQueryChange
  const isInstanceSymbols = param.optionsSource?.source === 'instanceSymbols'

  // Local search filter for non-API-backed options
  const filteredOptions = useMemo(() => {
    if (isInstanceSymbols) return options ?? []
    const q = (searchQuery ?? '').toLowerCase()
    if (!q) return options ?? []
    return (options ?? []).filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    )
  }, [options, searchQuery, isInstanceSymbols])

  const selectedOption = useMemo(() => {
    const val = String(rawValue ?? param.default ?? '')
    return (options ?? []).find((o) => o.value === val)
  }, [options, rawValue, param.default])

  const displayValue = hasVariable
    ? String(rawValue).replace(VAR_PATTERN, '$1')
    : selectedOption?.label ?? String(rawValue ?? param.default ?? '')

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">
          {label}
          {param.required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        <VariablePicker
          nodeId={nodeId}
          acceptTypes={param.acceptTypes}
          upstreamOutputs={upstreamOutputs}
          onSelect={handleVariableSelect}
          open={varPickerOpen}
          onOpenChange={setVarPickerOpen}
          currentValue={hasVariable ? parseVariableRef(String(rawValue)) ?? undefined : undefined}
        />
      </div>

      {hasVariable && (
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[10px]">
            {String(rawValue).replace(VAR_PATTERN, '$1')}
          </Badge>
          <button
            type="button"
            onClick={handleClearVariable}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {ui === 'select' ? (
        optionsLoading && !comboboxOpen ? (
          <div className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            加载中…
          </div>
        ) : (
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-8 w-full items-center justify-between rounded-md border border-border bg-background px-2 text-xs',
                  'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
                  !displayValue && 'text-muted-foreground',
                )}
                onClick={() => {
                  setComboboxOpen(true)
                  onSearchQueryChange?.('')
                }}
              >
                <span className="truncate">{displayValue || (param.placeholder ?? '请选择…')}</span>
                <svg
                  className="h-3 w-3 shrink-0 opacity-50"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
              align="start"
            >
              {hasSearch && (
                <div className="flex items-center border-b border-border px-2">
                  <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <input
                    ref={comboboxInputRef}
                    className="flex h-8 w-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
                    placeholder="搜索…"
                    value={searchQuery ?? ''}
                    onChange={(e) => onSearchQueryChange?.(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <ScrollArea className="max-h-[400px]">
                <div className="p-1">
                  {/* Variable options from upstream */}
                  {Object.entries(upstreamOutputs).map(([nid, fieldValues]) => {
                    const storeNodes = useWorkflowStore.getState().nodes
                    const node = storeNodes.find((n) => n.id === nid)
                    const nodeLabel = node
                      ? typeof node.data.label === 'string'
                        ? node.data.label
                        : (node.type ?? nid)
                      : nid
                    const nodeType = node?.type ?? ''
                    const outputs = NODE_OUTPUTS[nodeType]
                    if (!outputs) return null
                    return Object.keys(fieldValues).map((fieldName) => {
                      const fieldDef = outputs[fieldName]
                      const varValue = `{{${nodeLabel}.${fieldName}}}`
                      return (
                        <button
                          key={`var-${nid}-${fieldName}`}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs hover:bg-accent/50',
                            rawValue === varValue && 'bg-accent',
                          )}
                          onClick={() => {
                            handleValueChange(varValue)
                            setComboboxOpen(false)
                          }}
                        >
                          <Link className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {nodeLabel}.{fieldName}
                          </span>
                          {fieldDef && (
                            <Badge variant="secondary" className="ml-auto text-[10px]">
                              {fieldDef.type}
                            </Badge>
                          )}
                        </button>
                      )
                    })
                  })}
                  {/* Options */}
                  {optionsLoading ? (
                    <div className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      加载中…
                    </div>
                  ) : filteredOptions.length === 0 ? (
                    <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                      暂无选项
                    </div>
                  ) : (
                    filteredOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={cn(
                          'flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent/50',
                          rawValue === opt.value && 'bg-accent',
                        )}
                        onClick={() => {
                          handleValueChange(opt.value)
                          setComboboxOpen(false)
                          onSearchQueryChange?.('')
                        }}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )
      ) : ui === 'code' ? (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className={cn('h-8 font-mono text-xs', 'bg-muted/50')}
          placeholder={param.placeholder}
          value={String(rawValue ?? param.default ?? '')}
          onChange={(e) => handleValueChange(e.target.value)}
        />
      ) : ui === 'toggle' ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`field-${fieldKey}`}
            checked={isVariableRef(rawValue) ? false : Boolean(rawValue ?? param.default)}
            onCheckedChange={(checked) => handleValueChange(Boolean(checked))}
          />
          <Label htmlFor={`field-${fieldKey}`} className="text-xs text-muted-foreground">
            {param.description}
          </Label>
        </div>
      ) : ui === 'number' ? (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          className="h-8 text-xs"
          placeholder={param.placeholder}
          value={
            rawValue !== undefined
              ? String(rawValue)
              : param.default !== undefined
                ? String(param.default)
                : ''
          }
          onChange={(e) => handleValueChange(Number(e.target.value))}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          className="h-8 text-xs"
          placeholder={param.placeholder}
          value={String(rawValue ?? param.default ?? '')}
          onChange={(e) => handleValueChange(e.target.value)}
        />
      )}
    </div>
  )
}

// ── Full config form ──────────────────────────────────────────

function ConfigForm({
  nodeDef,
  nodeId,
  data,
  onChange,
  upstreamOutputs,
}: {
  nodeDef: NodeDef
  nodeId: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  upstreamOutputs: Record<string, Record<string, unknown>>
}) {
  const entries = Object.entries(nodeDef.executeInput)
  if (entries.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {entries.map(([key, param]) => (
        <ConfigFieldWithSource
          key={key}
          fieldKey={key}
          param={param}
          nodeId={nodeId}
          data={data}
          onChange={onChange}
          upstreamOutputs={upstreamOutputs}
        />
      ))}
    </div>
  )
}

// ── Field wrapper that resolves optionsSource ─────────────────

function ConfigFieldWithSource({
  fieldKey,
  param,
  nodeId,
  data,
  onChange,
  upstreamOutputs,
}: {
  fieldKey: string
  param: ParamDef
  nodeId: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  upstreamOutputs: Record<string, Record<string, unknown>>
}) {
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 200)
    return () => clearTimeout(t)
  }, [rawQuery])

  const { options, loading } = useOptionsSource(
    fieldKey,
    param.optionsSource,
    data,
    param.optionsSource?.source === 'instanceSymbols' ? debouncedQuery : undefined,
  )

  return (
    <ConfigField
      fieldKey={fieldKey}
      param={param}
      nodeId={nodeId}
      data={data}
      onChange={onChange}
      options={options}
      optionsLoading={loading}
      upstreamOutputs={upstreamOutputs}
      searchQuery={param.optionsSource ? rawQuery : undefined}
      onSearchQueryChange={param.optionsSource ? setRawQuery : undefined}
    />
  )
}

export { ConfigForm }
export type { VariableRef }
