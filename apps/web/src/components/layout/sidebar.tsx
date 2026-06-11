import { useState, useCallback, type ElementType, useMemo } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@eous/ui'
import {
  LayoutDashboard,
  Grid3x3,
  BrainCircuit,
  BarChart3,
  Newspaper,
  Settings,
  Wallet,
  Plus,
  GitBranch,
  ChevronDown,
} from 'lucide-react'
import { useWorkflowList } from '../../hooks/use-workflows'
import { CreateWorkflowDialog } from '../workflow/create-workflow-dialog'

interface NavItem {
  id: string
  label: string
  icon: ElementType
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
      { id: 'agents', label: 'Agents', icon: BrainCircuit },
      { id: 'datasets', label: 'Datasets', icon: Wallet },
    ],
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
  const { workflows } = useWorkflowList()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [workflowsCollapsed, setWorkflowsCollapsed] = useState(false)

  const isCollapsed = state === 'collapsed'
  const activeWorkflowId = extractWorkflowId(pathname)
  const isOnWorkflowPage = activeWorkflowId !== null

  const activeWorkflow = useMemo(
    () => workflows.find((wf) => wf.id === activeWorkflowId) ?? null,
    [workflows, activeWorkflowId],
  )

  const handleCreated = useCallback(
    (id: string) => {
      setDialogOpen(false)
      navigate(`/workflow/${id}`)
    },
    [navigate],
  )

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

          {(workflows.length > 0 || isOnWorkflowPage) && (
            <Collapsible
              open={!workflowsCollapsed}
              onOpenChange={(open) => setWorkflowsCollapsed(!open)}
              className="group/collapsible"
            >
              <SidebarGroup className="px-0">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="w-full cursor-pointer select-none">
                    <ChevronDown
                      size={12}
                      className="-ml-0.5 mr-1 -rotate-90 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-0"
                    />
                    WORKFLOWS
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <SidebarGroupAction
                  asChild
                  className="flex items-center justify-center"
                  onClick={() => setDialogOpen(true)}
                >
                  <Button size="xs" variant="ghost-icon">
                    <Plus size={14} />
                  </Button>
                </SidebarGroupAction>

                {/* 折叠时 pin 住选中的 workflow */}
                {workflowsCollapsed && activeWorkflow && (
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
                        {workflows.length === 0 ? (
                          <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-sidebar-foreground/40">
                            <Plus size={12} />
                            <span>暂无工作流</span>
                          </div>
                        ) : (
                          workflows.map((wf) => {
                            const isActive = activeWorkflowId === wf.id
                            return (
                              <SidebarMenuItem key={wf.id}>
                                {isActive && (
                                  <span className="pointer-events-none absolute -left-2 top-1/2 h-3 w-1.5 -translate-y-1/2 rounded-r-full bg-primary group-data-[collapsible=icon]:hidden" />
                                )}
                                <SidebarMenuButton asChild isActive={isActive} tooltip={wf.name}>
                                  <NavLink to={`/workflow/${wf.id}`} className="cursor-pointer">
                                    <GitBranch size={16} />
                                    <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
                                      {wf.name}
                                    </span>
                                  </NavLink>
                                </SidebarMenuButton>
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
          <SidebarMenu className="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isItemActive(pathname, '/settings')}
                tooltip="Settings"
              >
                <NavLink to="/settings" className="cursor-pointer">
                  <Settings size={16} />
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
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
