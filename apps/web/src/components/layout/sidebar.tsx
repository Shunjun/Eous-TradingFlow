import { useState, useCallback, type ElementType, useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useTheme,
  useSidebar,
} from '@eous/ui'
import {
  LayoutDashboard,
  Grid3x3,
  Bell,
  BrainCircuit,
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
  Trash2,
} from 'lucide-react'
import { useWorkflowList } from '../../hooks/use-workflows'
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
      { id: 'agents', label: 'Chat', icon: BrainCircuit },
      { id: 'home', label: 'Home', icon: LayoutDashboard },
      { id: 'dashboard', label: 'Dashboard', icon: Grid3x3 },
      { id: 'watchlist', label: 'Watchlist', icon: BarChart3 },
      { id: 'news', label: 'News Feed', icon: Newspaper },
    ],
  },
  {
    title: 'BUILD',
    items: [{ id: 'datasets', label: 'Datasets', icon: Wallet }],
  },
]

const navToPath: Record<string, string> = {
  home: '/home',
  dashboard: '/dashboard',
  watchlist: '/watchlist',
  news: '/news',
  agents: '/agents',
  datasets: '/datasets',
  settings: '/settings',
}

function isItemActive(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}

function extractWorkflowId(pathname: string): string | null {
  const m = pathname.match(/^\/workflow\/([^/]+)/)
  return m ? m[1] : null
}

export function AppSidebar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { state } = useSidebar()
  const { theme, setTheme } = useTheme()
  const { workflows } = useWorkflowList()
  const deleteWorkflow = useWorkflowListStore((s) => s.deleteWorkflow)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [workflowsCollapsed, setWorkflowsCollapsed] = useState(false)

  const isCollapsed = state === 'collapsed'
  const activeWorkflowId = extractWorkflowId(pathname)
  const isOnWorkflowPage = activeWorkflowId !== null

  const activeWorkflow = useMemo(
    () => workflows.find((wf) => wf.id === activeWorkflowId) ?? null,
    [workflows, activeWorkflowId],
  )
  const showPinnedActiveWorkflow = !isCollapsed && workflowsCollapsed && activeWorkflow

  const handleCreated = useCallback(
    (id: string) => {
      setDialogOpen(false)
      navigate(`/workflow/${id}`)
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

  const handleDeleteWorkflow = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const nextWorkflow = workflows.find((workflow) => workflow.id !== deleteTarget.id) ?? null
      await deleteWorkflow(deleteTarget.id)
      setDeleteTarget(null)
      if (activeWorkflowId === deleteTarget.id) {
        navigate(nextWorkflow ? `/workflow/${nextWorkflow.id}` : '/home')
      }
    } finally {
      setDeleting(false)
    }
  }, [activeWorkflowId, deleteTarget, deleteWorkflow, navigate, workflows])

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
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}

          {(!isCollapsed || isOnWorkflowPage) && (
            <Collapsible
              open={!workflowsCollapsed}
              onOpenChange={(open) => setWorkflowsCollapsed(!open)}
              className="group/collapsible"
            >
              <SidebarGroup className="px-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="w-full cursor-pointer select-none">
                    WORKFLOWS
                    <ChevronDown className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>

                {/* 折叠时 pin 住选中的 workflow */}
                {showPinnedActiveWorkflow && (
                  <SidebarMenu className="gap-0.5">
                    <SidebarMenuItem>
                      <span className="pointer-events-none absolute -left-2 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                      <SidebarMenuButton asChild isActive tooltip={activeWorkflow.name}>
                        <NavLink to={`/workflow/${activeWorkflow.id}`} className="cursor-pointer">
                          <GitBranch size={16} />
                          <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
                            {activeWorkflow.name}
                          </span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                )}

                <CollapsibleContent>
                  <SidebarGroupContent>
                    {isCollapsed && isOnWorkflowPage ? (
                      <SidebarMenu className="gap-0.5">
                        {activeWorkflow && (
                          <SidebarMenuItem>
                            <SidebarMenuButton asChild isActive tooltip={activeWorkflow.name}>
                              <NavLink
                                to={`/workflow/${activeWorkflow.id}`}
                                className="cursor-pointer"
                              >
                                <GitBranch size={16} />
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )}
                      </SidebarMenu>
                    ) : (
                      <SidebarMenu className="gap-0.5">
                        <SidebarMenuItem>
                          <SidebarMenuButton onClick={() => setDialogOpen(true)}>
                            <Plus size={16} />
                            <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">
                              新建工作流
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                        {workflows.length === 0 ? (
                          <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-sidebar-foreground/40">
                            <span>暂无工作流</span>
                          </div>
                        ) : (
                          workflows.map((wf) => {
                            const isActive = activeWorkflowId === wf.id
                            return (
                              <SidebarMenuItem key={wf.id} className="group/workflow-item">
                                {isActive && (
                                  <span className="pointer-events-none absolute -left-2 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                                )}
                                <SidebarMenuButton
                                  asChild
                                  isActive={isActive}
                                  tooltip={wf.name}
                                  className="pr-8"
                                >
                                  <NavLink to={`/workflow/${wf.id}`} className="cursor-pointer">
                                    <GitBranch size={16} />
                                    <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
                                      {wf.name}
                                    </span>
                                  </NavLink>
                                </SidebarMenuButton>
                                <button
                                  type="button"
                                  aria-label={`删除 ${wf.name}`}
                                  title="删除"
                                  className="absolute right-1 top-1/2 hidden size-6 -translate-y-1/2 items-center justify-center rounded-md text-sidebar-foreground/45 opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/workflow-item:flex group-hover/workflow-item:opacity-100 focus:flex focus:opacity-100 group-data-[collapsible=icon]:hidden"
                                  onClick={(event) => {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    setDeleteTarget({ id: wf.id, name: wf.name })
                                  }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </SidebarMenuItem>
                            )
                          })
                        )}
                      </SidebarMenu>
                    )}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )}
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
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>删除工作流</DialogTitle>
            <DialogDescription>
              确认删除「{deleteTarget?.name}」？该操作会移除工作流及相关版本记录。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteWorkflow}
            >
              {deleting ? '删除中…' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
