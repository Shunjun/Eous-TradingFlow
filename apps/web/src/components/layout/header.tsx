import { Search, Bell, Moon, Sun, LogOut } from 'lucide-react'
import {
  Button,
  Dot,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  SidebarTrigger,
  useTheme,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@eous/ui'
import { useState } from 'react'
import { api } from '../../lib/api.js'

export function Header() {
  const { theme, setTheme } = useTheme()
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 shrink-0 border-b border-border bg-card px-4">
      {/* Search */}
      <div className="flex h-full items-center justify-between gap-4">
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

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notification bell */}
          <Button variant="ghost-icon" className="relative">
            <Bell size={16} />
            <Dot size="xs" variant="glow" className="absolute top-1.5 right-1.5" />
          </Button>

          {/* Theme toggle */}
          <Button
            variant="ghost-icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                className="w-8 h-8 rounded-md border border-border flex items-center justify-center
                              font-mono text-xs text-muted-foreground hover:border-primary/40
                              hover:text-primary transition-all cursor-pointer"
              >
                S
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    await api.logout()
                  } catch {
                    /* ignore */
                  }
                  window.location.href = '/login'
                }}
                className="text-muted-foreground hover:text-red-400 cursor-pointer font-mono text-xs gap-2"
              >
                <LogOut size={13} />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
