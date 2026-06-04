import * as React from 'react'
import { Badge } from './badge'
import { Dot } from './dot'
import { cn } from '../../lib/utils'

type BadgeStatus = 'running' | 'completed' | 'failed' | 'idle' | 'success' | 'error'

const statusStyles: Record<BadgeStatus, string> = {
  running: 'text-primary bg-primary/10',
  completed: 'text-emerald-500 bg-emerald-500/10',
  success: 'text-emerald-500 bg-emerald-500/10',
  failed: 'text-red-400 bg-red-400/10',
  error: 'text-red-400 bg-red-400/10',
  idle: 'text-muted-foreground bg-muted',
}

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: BadgeStatus
  label: string
  showDot?: boolean
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, showDot = true, ...props }, ref) => {
    const dotVariant = status === 'running' ? 'pulse' : undefined

    return (
      <Badge
        ref={ref}
        variant="secondary"
        className={cn('font-mono text-[10px] px-2 py-0.5 rounded', statusStyles[status], className)}
        {...props}
      >
        {showDot && status === 'running' && (
          <Dot size="xs" variant={dotVariant} className="inline-block align-middle" />
        )}
        {label}
      </Badge>
    )
  },
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge }
