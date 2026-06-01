import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  GitBranch,
  BrainCircuit,
  BarChart3,
  Newspaper,
  Settings,
  ChevronLeft,
  ChevronRight,
  Wallet,
} from 'lucide-react'
import { cn, IconBox } from '@eous/ui'

interface NavItem {
  id: string
  label: string
  icon: React.ElementType
  badge?: string
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'watchlist', label: 'Watchlist', icon: BarChart3 },
      { id: 'news', label: 'News Feed', icon: Newspaper },
    ],
  },
  {
    title: 'BUILD',
    items: [
      { id: 'workflows', label: 'Workflows', icon: GitBranch, badge: '3' },
      { id: 'agents', label: 'Agents', icon: BrainCircuit },
      { id: 'datasets', label: 'Datasets', icon: Wallet },
    ],
  },
  {
    title: 'SYSTEM',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
]

const navToPath: Record<string, string> = {
  dashboard: '/',
  watchlist: '/watchlist',
  news: '/news',
  workflows: '/workflows',
  agents: '/agents',
  datasets: '/datasets',
  settings: '/settings',
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        'h-screen flex flex-col border-r border-border bg-card transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border shrink-0">
        <IconBox size="sm" className="border-[hsl(25,95%,53%)] bg-[hsl(25,95%,53%/0.1)]" interactive={false}>
          <GitBranch size={14} className="text-[hsl(25,95%,53%)]" />
        </IconBox>
        {!collapsed && (
          <span className="font-mono font-bold text-sm tracking-wide truncate">EOUS</span>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto overflow-x-visible py-3 px-2 space-y-5">
        {navSections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60 px-2 mb-1.5">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.id}
                    to={navToPath[item.id]}
                    end={navToPath[item.id] === '/'}
                    className={({ isActive }) =>
                      cn(
                        'w-full flex items-center gap-2.5 rounded-md transition-all duration-200 group relative',
                        collapsed ? 'justify-center px-2 py-2' : 'px-2.5 py-2',
                        isActive
                          ? 'bg-[hsl(25,95%,53%/0.1)] text-[hsl(25,95%,53%)]'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          size={16}
                          className={cn(
                            'shrink-0 transition-colors',
                            isActive
                              ? 'text-[hsl(25,95%,53%)]'
                              : 'text-muted-foreground group-hover:text-foreground'
                          )}
                        />
                        {!collapsed && (
                          <>
                            <span className="text-sm truncate flex-1 text-left">{item.label}</span>
                            {item.badge && (
                              <span className="font-mono text-[10px] bg-[hsl(25,95%,53%/0.15)]
                                               text-[hsl(25,95%,53%)] rounded px-1.5 py-0.5 leading-none">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {/* Active indicator */}
                        {isActive && (
                          <span className="absolute -left-[18px] top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-r-full bg-[hsl(25,95%,53%)]" />
                        )}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2 shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-2 py-2 rounded-md
                     text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
