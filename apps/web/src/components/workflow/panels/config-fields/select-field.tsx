import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Badge, Popover, PopoverContent, PopoverTrigger, ScrollArea, cn } from '@eous/ui'
import { getNodeDef } from '@eous/nodes'
import { useWorkflowStore } from '../../store/workflow-store'
import { getEffectiveOutputs } from '../settings-panel-outputs'
import { isVariableRef, parseVariableRef } from '../../variables/variable-ref'
import { VariableTag } from '../../variables'
import { useOptionsSource } from './use-options-source'
import type { ParamDef } from '@eous/nodes'

interface SelectOption {
  label: string
  value: string
}

interface SelectFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
  data: Record<string, unknown>
  upstreamOutputs: Record<string, Record<string, unknown>>
}

function useDebouncedValue(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timeout)
  }, [delay, value])

  return debouncedValue
}

function SelectOptionButton({
  selected,
  children,
  onSelect,
}: {
  selected: boolean
  children: React.ReactNode
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent/50',
        selected && 'bg-accent',
      )}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onSelect()
      }}
    >
      {children}
    </button>
  )
}

function SelectField({ param, value, onChange, data, upstreamOutputs }: SelectFieldProps) {
  const [open, setOpen] = useState(false)
  const [rawQuery, setRawQuery] = useState('')
  const [tab, setTab] = useState<'options' | 'variables'>('options')
  const storeNodes = useWorkflowStore((state) => state.nodes)
  const debouncedQuery = useDebouncedValue(rawQuery, 200)
  const apiQuery = param.optionsSource?.source === 'instanceSymbols' ? debouncedQuery : undefined
  const dynamicOptions = useOptionsSource(param.optionsSource, data, apiQuery)
  const options = param.options ?? dynamicOptions.options
  const loading = param.options ? false : dynamicOptions.loading
  const hasSearch = Boolean(param.optionsSource)
  const isInstanceSymbols = param.optionsSource?.source === 'instanceSymbols'

  const filteredOptions = useMemo(() => {
    if (isInstanceSymbols) return options
    const query = rawQuery.toLowerCase()
    if (!query) return options
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    )
  }, [isInstanceSymbols, options, rawQuery])

  const selectedOption = useMemo(() => {
    const selectedValue = String(value ?? param.default ?? '')
    return options.find((option) => option.value === selectedValue)
  }, [options, param.default, value])

  const variableRef = isVariableRef(value) ? parseVariableRef(String(value)) : null
  const displayValue = variableRef
    ? ''
    : (selectedOption?.label ?? String(value ?? param.default ?? ''))

  const handleSelect = (option: SelectOption) => {
    onChange(option.value)
    setOpen(false)
    setRawQuery('')
  }

  if (loading && !open) {
    return (
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        加载中…
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 w-full items-center justify-between rounded-md border border-border bg-background px-2 text-xs',
            'hover:bg-accent/50 focus:outline-none focus:ring-1 focus:ring-ring',
            !displayValue && 'text-muted-foreground',
          )}
          onClick={() => {
            setOpen(true)
            setRawQuery('')
            setTab('options')
          }}
        >
          {variableRef ? (
            <VariableTag refValue={variableRef} className="max-w-[calc(100%-1rem)]" />
          ) : (
            <span className="truncate">{displayValue || (param.placeholder ?? '请选择…')}</span>
          )}
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
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex border-b border-border p-1">
          <button
            type="button"
            className={cn(
              'flex-1 rounded-sm px-2 py-1 text-xs transition-colors',
              tab === 'options' ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setTab('options')}
          >
            选项
          </button>
          <button
            type="button"
            className={cn(
              'flex-1 rounded-sm px-2 py-1 text-xs transition-colors',
              tab === 'variables' ? 'bg-muted text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setTab('variables')}
          >
            变量
          </button>
        </div>
        {tab === 'options' && hasSearch && (
          <div className="flex items-center border-b border-border px-2">
            <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              className="flex h-8 w-full bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground"
              placeholder="搜索…"
              value={rawQuery}
              onChange={(event) => setRawQuery(event.target.value)}
              autoFocus
            />
          </div>
        )}
        <ScrollArea className="max-h-[400px]">
          <div className="p-1">
            {tab === 'variables' ? (
              Object.entries(upstreamOutputs).map(([nodeId, fieldValues]) => {
                const node = storeNodes.find((item) => item.id === nodeId)
                const nodeLabel = node
                  ? typeof node.data.label === 'string'
                    ? node.data.label
                    : (node.type ?? nodeId)
                  : nodeId
                const nodeType = node?.type ?? ''
                const outputs = getEffectiveOutputs(node?.data ?? {}, getNodeDef(nodeType))

                return Object.keys(fieldValues).map((fieldName) => {
                  const fieldDef = outputs.find((output) => output.name === fieldName)
                  const variableValue = `{{node:${nodeId}:${fieldName}}}`
                  return (
                    <SelectOptionButton
                      key={`var-${nodeId}-${fieldName}`}
                      selected={value === variableValue}
                      onSelect={() => {
                        onChange(variableValue)
                        setOpen(false)
                      }}
                    >
                      <VariableTag
                        refValue={{
                          nodeId,
                          nodeLabel,
                          fieldName,
                          fieldType: fieldDef?.type ?? '',
                        }}
                        className="min-w-0 flex-1"
                      />
                      {fieldDef && (
                        <Badge variant="secondary" className="ml-auto text-[10px]">
                          {fieldDef.type}
                        </Badge>
                      )}
                    </SelectOptionButton>
                  )
                })
              })
            ) : loading ? (
              <div className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                加载中…
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">暂无选项</div>
            ) : (
              filteredOptions.map((option) => (
                <SelectOptionButton
                  key={option.value}
                  selected={value === option.value}
                  onSelect={() => handleSelect(option)}
                >
                  <span className="truncate">{option.label}</span>
                </SelectOptionButton>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

export { SelectField }
