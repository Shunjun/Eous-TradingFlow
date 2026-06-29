import { useState, useCallback, useEffect, type ElementType } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Button,
  Dot,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useTheme,
  useSidebar,
} from '@eous/ui'
import {
  LayoutDashboard,
  Grid3x3,
  Bell,
  MessageCircle,
  BarChart3,
  Newspaper,
  LogOut,
  Moon,
  Settings,
  Sun,
  Wallet,
  Plus,
  GitBranch,
  ChevronDown,
} from 'lucide-react'
import { useRecentWorkflowsStore } from '../../stores/recent-workflows'
import { useWorkflowListStore } from '../../stores/workflows'
import { CreateWorkflowDialog } from '../workflow/dialogs'
import { api } from '../../lib/api'

interface NavItem {
  id: string
  label: string
  icon: ElementType
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: 'OVERVIEW',
    items: [
      { id: 'agents', label: 'Chat', icon: MessageCircle },
      { id: 'home', label: 'Home', icon: LayoutDashboard },
      { id: 'dashboard', label: 'Dashboard', icon: Grid3x3 },
      { id: 'watchlist', label: 'Watchlist', icon: BarChart3 },
      { id: 'news', label: 'News Feed', icon: Newspaper },
    ],
  },
  {
    title: 'BUILD',
    items: [
      { id: 'workflows', label: 'Workflows', icon: GitBranch },
      { id: 'datasets', label: 'Datasets', icon: Wallet },
    ],
  },
]

const navToPath: Record<string, string> = {
  home: '/home',
  dashboard: '/dashboard',
  watchlist: '/watchlist',
  news: '/news',
  agents: '/chat',
  datasets: '/datasets',
  workflows: '/workflows',
  settings: '/settings',
}

function isItemActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

function extractWorkflowId(pathname: string): string | null {
  const m =
    pathname.match(/^\/workflows\/([^/]+)(?:\/edit)?/) ?? pathname.match(/^\/workflow\/([^/]+)/)
  return m ? m[1] : null
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const { theme, setTheme } = useTheme()
  const recentWorkflows = useRecentWorkflowsStore((s) => s.recent)
  const retainExistingRecentWorkflows = useRecentWorkflowsStore((s) => s.retainExisting)
  const workflows = useWorkflowListStore((s) => s.workflows)
  const workflowsLoaded = useWorkflowListStore((s) => s.loaded)
  const loadWorkflows = useWorkflowListStore((s) => s.loadWorkflows)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [workflowsCollapsed, setWorkflowsCollapsed] = useState(false)

  const isCollapsed = state === 'collapsed'
  const activeWorkflowId = extractWorkflowId(pathname)

  useEffect(() => {
    void loadWorkflows()
  }, [loadWorkflows])

  useEffect(() => {
    if (!workflowsLoaded) return
    retainExistingRecentWorkflows(workflows.map((workflow) => workflow.id))
  }, [retainExistingRecentWorkflows, workflows, workflowsLoaded])

  const handleCreated = useCallback(
    (id: string) => {
      setDialogOpen(false)
      navigate(`/workflows/${id}/edit`)
    },
    [navigate],
  )

  const handleLogout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* ignore */
    }
    window.location.href = '/login'
  }, [])

  return (
    <>
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
            <SidebarGroup key={section.title} className="p-0">
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      item.id === 'workflows'
                        ? pathname === '/workflows'
                        : isItemActive(pathname, navToPath[item.id])
                    const Icon = item.icon

                    if (item.id === 'workflows') {
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={item.label}
                            className={cn(
                              'pr-14',
                              isActive &&
                                'before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary',
                            )}
                          >
                            <NavLink to={navToPath[item.id]} className="cursor-pointer">
                              <Icon size={16} />
                              <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                                {item.label}
                              </span>
                            </NavLink>
                          </SidebarMenuButton>
                          <SidebarMenuAction
                            className={cn(
                              'top-2!',
                              recentWorkflows.length > 0 ? 'right-7!' : 'right-1!',
                            )}
                            aria-label="新建工作流"
                            onClick={() => setDialogOpen(true)}
                          >
                            <Plus />
                          </SidebarMenuAction>
                          {recentWorkflows.length > 0 && (
                            <SidebarMenuAction
                              className="top-2!"
                              aria-label={workflowsCollapsed ? '展开最近工作流' : '折叠最近工作流'}
                              onClick={() => setWorkflowsCollapsed((value) => !value)}
                            >
                              <ChevronDown
                                className={cn(
                                  'transition-transform duration-200',
                                  !workflowsCollapsed && 'rotate-180',
                                )}
                              />
                            </SidebarMenuAction>
                          )}
                          {!isCollapsed && recentWorkflows.length > 0 && !workflowsCollapsed && (
                            <SidebarMenuSub>
                              {recentWorkflows.map((wf) => {
                                const isRecentActive = activeWorkflowId === wf.id

                                return (
                                  <SidebarMenuSubItem key={wf.id}>
                                    <SidebarMenuSubButton asChild isActive={isRecentActive}>
                                      <NavLink
                                        to={`/workflows/${wf.id}/edit`}
                                        className="cursor-pointer"
                                      >
                                        <span>{wf.name}</span>
                                      </NavLink>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                )
                              })}
                            </SidebarMenuSub>
                          )}
                        </SidebarMenuItem>
                      )
                    }

                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.label}
                          className={cn(
                            isActive &&
                              'before:absolute before:left-0 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary',
                          )}
                        >
                          <NavLink to={navToPath[item.id]} className="cursor-pointer">
                            <Icon size={16} />
                            <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                              {item.label}
                            </span>
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

        <SidebarSeparator />
        <SidebarFooter className="px-3 py-3">
          <div className="grid grid-cols-4 gap-1 group-data-[collapsible=icon]:grid-cols-1">
            <Button
              asChild
              variant="ghost-icon"
              size="sm"
              aria-label="Settings"
              className={cn(
                'relative size-8 p-0',
                isItemActive(pathname, '/settings') &&
                  'bg-sidebar-active text-sidebar-active-foreground',
              )}
            >
              <NavLink to="/settings" className="cursor-pointer">
                <Settings size={16} />
              </NavLink>
            </Button>

            <Button
              variant="ghost-icon"
              size="sm"
              aria-label="Alerts"
              className="relative size-8 p-0"
            >
              <Bell size={16} />
              <Dot size="xs" variant="glow" className="absolute right-1.5 top-1.5" />
            </Button>

            <Button
              variant="ghost-icon"
              size="sm"
              aria-label="Toggle theme"
              className="size-8 p-0"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost-icon" size="sm" aria-label="Account" className="size-8 p-0">
                  <span className="flex size-5 items-center justify-center rounded-sm border border-border font-mono text-[10px] text-muted-foreground">
                    S
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="right" className="w-40">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer gap-2 text-xs font-mono text-muted-foreground hover:text-red-400"
                >
                  <LogOut size={13} />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </SidebarFooter>
      </Sidebar>

      <CreateWorkflowDialog
        open={dialogOpen}
        onCreated={handleCreated}
        onCancel={() => setDialogOpen(false)}
      />
    </>
  )
}
