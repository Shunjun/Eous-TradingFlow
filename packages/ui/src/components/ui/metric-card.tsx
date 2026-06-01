import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

const metricCardVariants = cva(
  'border border-border rounded-lg p-4 group transition-all duration-300 cursor-default',
  {
    variants: {
      variant: {
        default:
          'hover:border-primary/30 hover:bg-primary/5',
        compact:
          'hover:border-primary/30 hover:bg-primary/5 text-center',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface MetricCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof metricCardVariants> {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon?: React.ElementType
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ className, variant, label, value, change, trend, icon: Icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(metricCardVariants({ variant }), className)}
      {...props}
    >
      {variant === 'compact' ? (
        <>
          <span className="font-mono text-xl font-bold block">{value}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1 block">
            {label}
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {label}
            </span>
            {Icon && <Icon size={14} className="text-muted-foreground/50" />}
          </div>
          <div className="flex items-end gap-2">
            <span className="font-mono text-2xl font-bold">{value}</span>
            {change && (
              <span
                className={cn(
                  'font-mono text-xs mb-1',
                  trend === 'up' && 'text-emerald-500',
                  trend === 'down' && 'text-red-400',
                  (!trend || trend === 'neutral') && 'text-muted-foreground',
                )}
              >
                {trend === 'up' && <TrendingUp size={10} className="inline mr-0.5" />}
                {trend === 'down' && <TrendingDown size={10} className="inline mr-0.5" />}
                {change}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  ),
)
MetricCard.displayName = 'MetricCard'

export { MetricCard, metricCardVariants }
