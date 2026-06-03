import { useState } from 'react'
import { Button, cn } from '@eous/ui'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from '@eous/ui'
import { Settings2, Plus, Trash2, ArrowUp, ArrowDown, Layers, Merge } from 'lucide-react'
import type { IndicatorConfig } from '../types'
import { INDICATOR_REGISTRY, INDICATOR_TYPES } from '../indicators/registry'

interface IndicatorPopoverProps {
  indicators: IndicatorConfig[]
  onAdd: (config: IndicatorConfig) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onSwitchMode: (id: string, mode: 'overlay' | 'split') => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
}

function generateId(type: string, params: Record<string, number>): string {
  const paramStr = Object.values(params).join('-')
  return `${type}-${paramStr}`
}

function formatLabel(type: string, params: Record<string, number>): string {
  const def = INDICATOR_REGISTRY[type]
  if (!def) return type
  const paramStr = Object.entries(params)
    .map(([k, v]) => `${v}`)
    .join(', ')
  return `${def.label}(${paramStr})`
}

export function IndicatorPopover({
  indicators,
  onAdd,
  onRemove,
  onToggle,
  onSwitchMode,
  onMoveUp,
  onMoveDown,
}: IndicatorPopoverProps) {
  const [showAdd, setShowAdd] = useState(false)

  function handleAddNew(type: string) {
    const def = INDICATOR_REGISTRY[type]
    if (!def) return
    const id = generateId(type, def.defaultParams)
    onAdd({
      id,
      type,
      label: formatLabel(type, def.defaultParams),
      enabled: true,
      mode: def.defaultMode,
      params: { ...def.defaultParams },
    })
    setShowAdd(false)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost-icon" size="icon" className="h-7 w-7">
          <Settings2 size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 font-mono text-xs">
        {/* Active indicators */}
        {indicators.length > 0 && (
          <>
            {indicators.map((ind) => (
              <div key={ind.id}>
                <DropdownMenuCheckboxItem
                  checked={ind.enabled}
                  onCheckedChange={() => onToggle(ind.id)}
                  onSelect={(e) => e.preventDefault()}
                  className="gap-1"
                >
                  <span className="flex-1 truncate">{ind.label}</span>
                  <span
                    className={cn(
                      'text-[9px] px-1 rounded',
                      ind.mode === 'overlay'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400',
                    )}
                  >
                    {ind.mode === 'overlay' ? '叠' : '分'}
                  </span>
                </DropdownMenuCheckboxItem>
                <div className="flex items-center px-2 py-0.5 gap-1">
                  <button
                    onClick={() => onSwitchMode(ind.id, ind.mode === 'overlay' ? 'split' : 'overlay')}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
                    title={ind.mode === 'overlay' ? '切换为拆分' : '切换为叠加'}
                  >
                    {ind.mode === 'overlay' ? <Merge size={10} /> : <Layers size={10} />}
                  </button>
                  <button
                    onClick={() => onMoveUp(ind.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
                    title="上移"
                  >
                    <ArrowUp size={10} />
                  </button>
                  <button
                    onClick={() => onMoveDown(ind.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
                    title="下移"
                  >
                    <ArrowDown size={10} />
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={() => onRemove(ind.id)}
                    className="text-muted-foreground hover:text-red-400 p-0.5 rounded hover:bg-muted/50"
                    title="删除"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Add indicator */}
        {INDICATOR_TYPES.map((type) => {
          const def = INDICATOR_REGISTRY[type]
          if (!def) return null
          return (
            <DropdownMenuItem key={type} onClick={() => handleAddNew(type)}>
              <Plus size={12} className="text-muted-foreground" />
              <span>{def.label}</span>
              <span className="text-muted-foreground text-[9px] ml-auto">
                {Object.entries(def.defaultParams)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')}
              </span>
            </DropdownMenuItem>
          )
        })}

        {indicators.length === 0 && (
          <div className="px-2 py-1.5 text-muted-foreground text-[10px]">
            点击上方添加指标
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
