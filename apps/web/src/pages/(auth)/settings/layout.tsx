import { NavLink, Outlet } from 'react-router-dom'
import { Settings, Bot, Sliders, Cpu } from 'lucide-react'
import { cn } from '@eous/ui'

const subNav = [
  { to: '/settings/general', label: 'General', icon: Sliders },
  { to: '/settings/providers', label: 'Providers', icon: Bot },
  { to: '/settings/models', label: 'Models', icon: Cpu },
]

export default function SettingsLayout() {
  return (
    <div className="flex h-full">
      {/* Sub-nav */}
      <aside className="w-52 border-r border-border shrink-0 py-4 px-3 space-y-1">
        <div className="flex items-center gap-2 px-2 mb-3">
          <Settings size={14} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            Settings
          </span>
        </div>
        {subNav.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-[hsl(25,95%,53%/0.1)] text-[hsl(25,95%,53%)]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={16}
                    className={cn(
                      'shrink-0 transition-colors',
                      isActive ? 'text-[hsl(25,95%,53%)]' : 'text-muted-foreground',
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          )
        })}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  )
}
