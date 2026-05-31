import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { Dot } from './dot'

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded',
  {
    variants: {
      status: {
        running: 'text-[hsl(25,95%,53%)] bg-[hsl(25,95%,53%/0.1)]',
        completed: 'text-emerald-500 bg-emerald-500/10',
        success: 'text-emerald-500 bg-emerald-500/10',
        failed: 'text-red-400 bg-red-400/10',
        error: 'text-red-400 bg-red-400/10',
        idle: 'text-muted-foreground bg-muted',
      },
    },
    defaultVariants: {
      status: 'idle',
    },
  },
)

type BadgeStatus = 'running' | 'completed' | 'failed' | 'idle' | 'success' | 'error'

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: BadgeStatus
  label: string
  showDot?: boolean
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, status, label, showDot = true, ...props }, ref) => {
    const dotVariant = status === 'running' ? 'pulse' : undefined

    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ status }), className)}
        {...props}
      >
        {showDot && status === 'running' && (
          <Dot size="xs" variant={dotVariant} className="inline-block align-middle" />
        )}
        {label}
      </span>
    )
  },
)
StatusBadge.displayName = 'StatusBadge'

export { StatusBadge, statusBadgeVariants }
