import * as React from 'react'
import { cn } from '../../lib/utils'

/* ─── CardPanel ─── */
export interface CardPanelProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardPanel = React.forwardRef<HTMLDivElement, CardPanelProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border border-border rounded-lg overflow-hidden', className)}
      {...props}
    />
  ),
)
CardPanel.displayName = 'CardPanel'

/* ─── CardPanelHeader ─── */
export interface CardPanelHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ElementType
  title: string
  action?: {
    label: React.ReactNode
    onClick?: () => void
  }
}

export const CardPanelHeader = React.forwardRef<HTMLDivElement, CardPanelHeaderProps>(
  ({ className, icon: Icon, title, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between px-4 py-3 border-b border-border',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-muted-foreground" />}
        <span className="text-sm font-medium">{title}</span>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  ),
)
CardPanelHeader.displayName = 'CardPanelHeader'

/* ─── CardPanelBody ─── */
export interface CardPanelBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardPanelBody = React.forwardRef<HTMLDivElement, CardPanelBodyProps>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  ),
)
CardPanelBody.displayName = 'CardPanelBody'
