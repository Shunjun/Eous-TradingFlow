import type { ReactNode } from 'react'

const NODE_ICON_LABELS: Record<string, string> = {
  brain: 'AI',
  'candlestick-chart': 'K',
  'dollar-sign': '$',
  'file-text': 'R',
  'git-branch': 'IF',
  'message-square': 'LLM',
}

export interface NodeDetail {
  label: string
  value: ReactNode
}

interface NodeCardProps {
  icon: string
  title: string
  color?: string
  details: NodeDetail[]
}

function NodeCard({ icon, title, color, details }: NodeCardProps) {
  const iconLabel = NODE_ICON_LABELS[icon] ?? 'N'

  return (
    <div className="w-[180px] overflow-hidden rounded-[10px] bg-card">
      <div className="flex min-h-9 items-center gap-2 border-b border-border/80 px-2.5">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/55 text-foreground"
          style={
            color ? { color, backgroundColor: `${color}14`, borderColor: `${color}33` } : undefined
          }
        >
          <span className="text-[9px] font-bold leading-none">{iconLabel}</span>
        </div>
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold leading-4 text-foreground">
            {title}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {details.map((detail) => (
          <div
            key={detail.label}
            className="grid grid-cols-[58px_minmax(0,1fr)] gap-2 px-2.5 py-1.5"
          >
            <span className="truncate text-[10px] font-medium uppercase leading-4 text-muted-foreground">
              {detail.label}
            </span>
            <span className="truncate text-right font-mono text-[10px] leading-4 text-foreground/85">
              {detail.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function emptyValue(value: string | number | undefined | null): string | number {
  if (value === undefined || value === null || value === '') return '--'
  return value
}

export { NodeCard, emptyValue }
