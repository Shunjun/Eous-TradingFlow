import type { ElementType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Badge,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@eous/ui'
import {
  LayoutDashboard,
  Grid3x3,
  GitBranch,
  BrainCircuit,
  BarChart3,
  Newspaper,
  Settings,
  Wallet,
} from 'lucide-react'

interface NavItem {
  id: string
  label: string
  icon: ElementType
  badge?: string
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'home', label: 'Home', icon: LayoutDashboard },
      { id: 'dashboard', label: 'Dashboard', icon: Grid3x3 },
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
    items: [{ id: 'settings', label: 'Settings', icon: Settings }],
  },
]

const navToPath: Record<string, string> = {
  home: '/home',
  dashboard: '/dashboard',
  watchlist: '/watchlist',
  news: '/news',
  workflows: '/workflows',
  agents: '/agents',
  datasets: '/datasets',
  settings: '/settings',
}

function isItemActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar() {
  const { pathname } = useLocation()

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="h-14 shrink-0 flex-row items-center gap-2.5 px-3.5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-md border border-primary bg-primary/10">
            <GitBranch size={14} className="text-primary" />
          </div>
          <span className="truncate font-mono text-sm font-bold tracking-wide group-data-[collapsible=icon]:hidden">
            EOUS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-3">
        {navSections.map((section) => (
          <SidebarGroup key={section.title} className="mb-5 px-0 py-0">
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {section.items.map((item) => {
                  const isActive = isItemActive(pathname, navToPath[item.id])
                  const Icon = item.icon

                  return (
                    <SidebarMenuItem key={item.id}>
                      {isActive && (
                        <span className="pointer-events-none absolute -left-2 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                      )}
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                        <NavLink to={navToPath[item.id]} className="cursor-pointer">
                          <Icon size={16} />
                          <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                            {item.label}
                          </span>
                          {item.badge && (
                            <Badge className="border-0 bg-sidebar-primary/15 px-1.5 py-0.5 font-mono text-[10px] leading-none text-sidebar-primary group-data-[collapsible=icon]:hidden">
                              {item.badge}
                            </Badge>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
