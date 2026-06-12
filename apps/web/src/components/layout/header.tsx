import { Search } from 'lucide-react'
import { InputGroup, InputGroupAddon, InputGroupInput, SidebarTrigger } from '@eous/ui'
import { useState } from 'react'

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4">
      {/* Search */}
      <div className="flex h-full items-center gap-3">
        <div className="flex flex-1 items-center gap-3">
          <SidebarTrigger className="shrink-0" />
          <InputGroup
            className={`flex max-w-md flex-1 items-center gap-2 rounded-md border py-1.5 transition-all duration-200 ${
              searchFocused ? 'border-primary/40 bg-primary/5' : 'border-border bg-muted/50'
            }`}
          >
            <InputGroupInput
              type="text"
              placeholder="Search workflows, assets..."
              className="font-mono text-xs text-foreground placeholder:text-muted-foreground/50"
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <InputGroupAddon align="inline-start">
              <Search size={14} className="text-muted-foreground shrink-0" />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end" className="hidden sm:inline-flex">
              <kbd className="border border-border px-1 py-0.5 font-mono text-[10px] text-muted-foreground/50">
                /
              </kbd>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>
    </header>
  )
}
