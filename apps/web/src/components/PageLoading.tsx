import { Loader2 } from 'lucide-react'
import { cn } from '@eous/ui'

interface PageLoadingProps {
  label?: string
  className?: string
  fullScreen?: boolean
}

export function PageLoading({
  label = 'Loading...',
  className,
  fullScreen = false,
}: PageLoadingProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-background text-muted-foreground',
        fullScreen ? 'h-screen' : 'h-full min-h-64',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Loader2 className="size-4 animate-spin" />
        <span>{label}</span>
      </div>
    </div>
  )
}
