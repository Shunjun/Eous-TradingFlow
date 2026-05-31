import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const dotVariants = cva('inline-block rounded-full bg-[hsl(25,95%,53%)]', {
  variants: {
    size: {
      xs: 'w-1 h-1',
      sm: 'w-1.5 h-1.5',
      md: 'w-2 h-2',
      lg: 'w-2.5 h-2.5',
    },
    variant: {
      static: '',
      pulse: 'animate-dot-pulse',
      breath: 'animate-dot-breath',
      glow: 'animate-dot-glow',
    },
  },
  defaultVariants: {
    size: 'sm',
    variant: 'pulse',
  },
})

export interface DotProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dotVariants> {}

const Dot = React.forwardRef<HTMLSpanElement, DotProps>(
  ({ className, size, variant, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(dotVariants({ size, variant }), className)}
      {...props}
    />
  ),
)
Dot.displayName = 'Dot'

export { Dot, dotVariants }
