import type { NodeComponentProps } from '../types'
import { def } from './def'

function CanvasNode({ data }: NodeComponentProps) {
  const condition = typeof data.condition === 'string' ? data.condition : ''
  const label = typeof data.label === 'string' ? data.label : def.meta.label
  const color = typeof data.color === 'string' ? data.color : undefined

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-1.5">
        {color && (
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
        )}
        <span className="text-[11px] font-medium text-foreground">{label}</span>
      </div>
      <div className="flex flex-col items-center gap-2 px-3 py-2">
        <svg
          className="h-6 w-6 text-violet-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>
        {condition ? (
          <span className="w-full truncate rounded bg-muted px-2 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
            {condition}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">设置条件…</span>
        )}
      </div>
    </div>
  )
}

export { CanvasNode }
