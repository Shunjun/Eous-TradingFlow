import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const iconBoxVariants = cva(
  'rounded border border-border flex items-center justify-center shrink-0 transition-all',
  {
    variants: {
      size: {
        sm: 'w-7 h-7',
        md: 'w-8 h-8',
        lg: 'w-9 h-9',
      },
      interactive: {
        true: 'group-hover:border-primary/40 group-hover:bg-primary/5',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      interactive: true,
    },
  },
)

export interface IconBoxProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof iconBoxVariants> {}

const IconBox = React.forwardRef<HTMLDivElement, IconBoxProps>(
  ({ className, size, interactive, ...props }, ref) => (
    <div ref={ref} className={cn(iconBoxVariants({ size, interactive }), className)} {...props} />
  ),
)
IconBox.displayName = 'IconBox'

export { IconBox, iconBoxVariants }
