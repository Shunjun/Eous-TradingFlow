import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  heading: React.ReactNode
  headingAccent?: React.ReactNode
  description?: string
}

const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ className, label, heading, headingAccent, description, ...props }, ref) => (
    <div ref={ref} className={cn('mb-14', className)} {...props}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 max-w-10 bg-primary/40" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          {label}
        </span>
      </div>
      <h2 className="font-mono text-2xl md:text-3xl font-bold mb-3">
        {heading}
        {headingAccent && <span className="text-muted-foreground">{headingAccent}</span>}
      </h2>
      {description && <p className="text-muted-foreground text-sm max-w-lg">{description}</p>}
    </div>
  ),
)
SectionHeader.displayName = 'SectionHeader'

export { SectionHeader }
