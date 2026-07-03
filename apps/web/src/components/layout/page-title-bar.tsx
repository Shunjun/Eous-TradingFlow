import type { ReactNode } from 'react'
import { Button } from '@eous/ui'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

type PageTitleBarProps = {
  backLabel?: string
  backTo?: string
  title: ReactNode
  actions?: ReactNode
}

export function PageTitleBar({ backLabel, backTo, title, actions }: PageTitleBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
      <div className="flex min-w-0 items-center gap-3">
        {backTo && backLabel ? (
          <>
            <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-muted-foreground">
              <Link to={backTo}>
                <ArrowLeft size={15} />
                {backLabel}
              </Link>
            </Button>
            <div className="h-5 w-px bg-border" />
          </>
        ) : null}
        <h1 className="truncate text-lg font-semibold tracking-normal text-foreground">{title}</h1>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}
