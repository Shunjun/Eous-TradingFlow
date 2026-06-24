import type { CSSProperties, ElementType } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Settings, Bot, Sliders, Database, BrainCircuit } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  cn,
} from '@eous/ui'

const subNav = [
  { to: '/settings/general', label: 'General', icon: Sliders },
  { to: '/settings/providers', label: 'Providers', icon: Bot },
  { to: '/settings/agents', label: 'Agents', icon: BrainCircuit },
  { to: '/settings/data-sources', label: 'Data Sources', icon: Database },
]

function isSubNavActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

export default function SettingsLayout() {
  const { pathname } = useLocation()

  return (
    <SidebarProvider
      defaultOpen
      className="h-full min-h-0"
      style={
        {
          '--sidebar-width': '13rem',
          '--sidebar-width-icon': '13rem',
        } as CSSProperties
      }
    >
      <Sidebar
        collapsible="none"
        className="shrink-0 border-r border-sidebar-border bg-transparent"
      >
        <SidebarContent className="px-3 py-4">
          <div className="mb-3 flex items-center gap-2 px-2">
            <Settings size={14} className="text-muted-foreground" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
              Settings
            </span>
          </div>
          <SidebarMenu className="gap-1">
            {subNav.map((item) => (
              <SettingsNavItem
                key={item.to}
                item={item}
                isActive={isSubNavActive(pathname, item.to)}
              />
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </SidebarProvider>
  )
}

function SettingsNavItem({
  item,
  isActive,
}: {
  item: { to: string; label: string; icon: ElementType }
  isActive: boolean
}) {
  const Icon = item.icon

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="h-auto gap-2.5 px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:font-normal data-[active=true]:text-primary"
      >
        <NavLink to={item.to}>
          <Icon
            size={16}
            className={cn(
              'shrink-0 transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          <span className="truncate">{item.label}</span>
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
