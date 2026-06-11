import type { NodeComponentProps } from '../types'
import { def } from './def'

function CanvasNode({ data }: NodeComponentProps) {
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined
  const modelId = typeof data.modelId === 'string' ? data.modelId : ''

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
        {color && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: color }}
          />
        )}
        <span className="text-[11px] font-medium text-foreground">{label}</span>
      </div>
      <div className="px-3 py-1.5">
        <span className="text-[10px] text-muted-foreground">{modelId || '--'} · Markdown 报告</span>
      </div>
    </div>
  )
}

export { CanvasNode }
