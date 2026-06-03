import { useState } from 'react'
import { Button, cn } from '@eous/ui'
import { ArrowLeft, Plus, ChevronUp, ChevronDown, Layers, Merge, Trash2 } from 'lucide-react'
import type { IndicatorConfig, IndicatorDefinition, IndicatorDisplayMode } from '../types'
import { getAllIndicatorDefinitions, getIndicatorDefinition } from '../indicators/registry'

// ── Types ───────────────────────────────────────────────────────────────────

interface IndicatorPanelProps {
  indicators: IndicatorConfig[]
  onAdd: (config: IndicatorConfig) => void
  onRemove: (id: string) => void
  onToggle: (id: string) => void
  onSwitchMode: (id: string, mode: IndicatorDisplayMode) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onUpdateConfig: (id: string, updates: Partial<IndicatorConfig>) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function generateId(type: string, params: Record<string, number>): string {
  const paramStr = Object.values(params).join('-')
  return `${type}-${paramStr}`
}

function formatLabel(type: string, params: Record<string, number>): string {
  const def = getIndicatorDefinition(type)
  if (!def) return type
  const paramStr = Object.entries(params)
    .map(([, v]) => `${v}`)
    .join(', ')
  return `${def.label}(${paramStr})`
}

// ── Component ───────────────────────────────────────────────────────────────

export function IndicatorPanel({
  indicators,
  onAdd,
  onRemove,
  onToggle,
  onSwitchMode,
  onMoveUp,
  onMoveDown,
  onUpdateConfig,
}: IndicatorPanelProps) {
  const [view, setView] = useState<'list' | 'settings'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAddList, setShowAddList] = useState(false)

  const selectedConfig = selectedId ? indicators.find((i) => i.id === selectedId) : null
  const selectedDef = selectedConfig ? getIndicatorDefinition(selectedConfig.type) : null

  function handleSelectIndicator(id: string) {
    setSelectedId(id)
    setView('settings')
  }

  function handleBack() {
    setView('list')
    setSelectedId(null)
    setShowAddList(false)
  }

  function handleAddNew(type: string) {
    const def = getIndicatorDefinition(type)
    if (!def) return
    const id = generateId(type, def.defaultParams)
    onAdd({
      id,
      type,
      label: formatLabel(type, def.defaultParams),
      enabled: true,
      mode: def.defaultMode,
      params: { ...def.defaultParams },
      colors: [...def.defaultColors],
    })
    setShowAddList(false)
  }

  const availableTypes = getAllIndicatorDefinitions()

  return (
    <div className="flex flex-col h-full w-[280px] border-l border-border bg-background shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        {view === 'settings' ? (
          <>
            <button
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
            >
              <ArrowLeft size={14} />
            </button>
            <span className="text-xs font-mono font-medium truncate">
              {selectedDef?.label ?? '指标设置'}
            </span>
          </>
        ) : (
          <span className="text-xs font-mono font-medium">指标</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'list' && (
          <div className="flex flex-col">
            {/* Active indicators */}
            {indicators.map((ind) => (
              <div key={ind.id} className="border-b border-border/50">
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleSelectIndicator(ind.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggle(ind.id)
                    }}
                    className={cn(
                      'w-3 h-3 rounded-full border shrink-0 transition-colors',
                      ind.enabled
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/40',
                    )}
                  />
                  <span className="flex-1 text-xs font-mono truncate">{ind.label}</span>
                  <span
                    className={cn(
                      'text-[9px] px-1 rounded shrink-0',
                      ind.mode === 'overlay'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-orange-500/20 text-orange-400',
                    )}
                  >
                    {ind.mode === 'overlay' ? '叠' : '分'}
                  </span>
                </div>
                <div className="flex items-center px-3 pb-2 gap-1">
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
                    <ChevronUp size={10} />
                  </button>
                  <button
                    onClick={() => onMoveDown(ind.id)}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-muted/50"
                    title="下移"
                  >
                    <ChevronDown size={10} />
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

            {indicators.length === 0 && !showAddList && (
              <div className="px-3 py-4 text-muted-foreground text-[10px] font-mono text-center">
                暂无指标
              </div>
            )}

            {/* Add indicator button / list */}
            {showAddList ? (
              <div className="border-t border-border">
                <div className="px-3 py-2 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                  选择指标类型
                </div>
                {availableTypes.map((def) => (
                  <button
                    key={def.type}
                    onClick={() => handleAddNew(def.type)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono hover:bg-muted/30 transition-colors text-left"
                  >
                    <Plus size={12} className="text-muted-foreground shrink-0" />
                    <span className="flex-1">{def.label}</span>
                    <span className="text-muted-foreground text-[9px]">
                      {Object.entries(def.defaultParams)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(' ')}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <button
                onClick={() => setShowAddList(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors border-t border-border"
              >
                <Plus size={12} />
                <span>添加指标</span>
              </button>
            )}
          </div>
        )}

        {view === 'settings' && selectedConfig && selectedDef && (
          <selectedDef.SettingsComponent
            config={selectedConfig}
            onUpdate={(updates) => onUpdateConfig(selectedConfig.id, updates)}
            onRemove={() => {
              onRemove(selectedConfig.id)
              handleBack()
            }}
          />
        )}
      </div>
    </div>
  )
}
