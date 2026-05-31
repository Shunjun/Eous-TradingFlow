import * as React from 'react'
import { cn } from '../../lib/utils'

export interface DataRowProps extends React.HTMLAttributes<HTMLDivElement> {
  leading?: React.ReactNode
  trailing?: React.ReactNode
}

const DataRow = React.forwardRef<HTMLDivElement, DataRowProps>(
  ({ className, leading, trailing, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 border-b border-border/50 last:border-0',
        'hover:bg-muted/30 transition-colors cursor-pointer group',
        className,
      )}
      {...props}
    >
      {leading}
      <div className="flex-1 min-w-0">{children}</div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  ),
)
DataRow.displayName = 'DataRow'

export { DataRow }
