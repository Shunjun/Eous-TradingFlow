import { Search, Bell, Moon, Sun, LogOut } from 'lucide-react'
import {
  Button,
  Dot,
  useTheme,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@eous/ui'
import { useState } from 'react'

export function Header() {
  const { theme, setTheme } = useTheme()
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-5 shrink-0 bg-card">
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div
          className={`flex items-center gap-2 flex-1 rounded-md border px-3 py-1.5 transition-all duration-200 ${
            searchFocused
              ? 'border-primary/40 bg-primary/5'
              : 'border-border bg-muted/50'
          }`}
        >
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="Search workflows, assets..."
            className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground/50
                       font-mono text-xs"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <kbd
            className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px]
                         text-muted-foreground/50 border border-border rounded px-1 py-0.5"
          >
            /
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Button variant="ghost-icon" size="icon" className="relative">
          <Bell size={16} />
          <Dot size="xs" variant="glow" className="absolute top-1.5 right-1.5" />
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost-icon"
          size="icon"
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
                  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
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
    </header>
  )
}
