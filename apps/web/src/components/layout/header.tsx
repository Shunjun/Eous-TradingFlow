import { Search, Bell, Moon, Sun, LogOut } from 'lucide-react'
import { Button, Dot, useTheme } from '@eous/ui'
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
              ? 'border-[hsl(25,95%,53%/0.4)] bg-[hsl(25,95%,53%/0.03)]'
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
          <kbd className="hidden sm:inline-flex items-center gap-0.5 font-mono text-[10px]
                         text-muted-foreground/50 border border-border rounded px-1 py-0.5">
            /
          </kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-md
                          text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Bell size={16} />
          <Dot size="xs" variant="glow" className="absolute top-1.5 right-1.5" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-8 h-8 flex items-center justify-center rounded-md
                     text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {/* User avatar / Logout */}
        <button
          onClick={async () => {
            try {
              await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
              })
            } catch {
              // ignore network errors, still redirect
            }
            window.location.href = '/login'
          }}
          className="w-8 h-8 rounded-md border border-border flex items-center justify-center
                    font-mono text-xs text-muted-foreground hover:border-red-500/40
                    hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
          title="Logout"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
