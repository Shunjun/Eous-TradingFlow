import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import {
  Check,
  Eye,
  GitBranch,
  History,
  ListTree,
  Rocket,
  ScrollText,
  Trash2,
  Variable,
} from 'lucide-react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from '@eous/ui'
import { useWorkflowList } from '../../../hooks/use-workflows'
import { useWorkflowListStore } from '../../../stores/workflows'
import { useWorkflowStore } from '../store/workflow-store'

interface HeaderBarProps {
  saving: boolean
  publishing: boolean
  isPublished: boolean
  showWorkflowList?: boolean
  onPublish: () => void
  onWorkflowSelect?: (workflowId: string | null) => void
}

function HeaderBar({
  saving,
  publishing,
  isPublished,
  showWorkflowList = false,
  onPublish,
  onWorkflowSelect,
}: HeaderBarProps) {
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const isDirty = useWorkflowStore((s) => s.isDirty)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)
  const logOpen = useWorkflowStore((s) => s.logOpen)
  const utilityPanel = useWorkflowStore((s) => s.utilityPanel)
  const toggleLogOpen = useWorkflowStore((s) => s.toggleLogOpen)
  const toggleUtilityPanel = useWorkflowStore((s) => s.toggleUtilityPanel)
  const { workflows, loading: workflowsLoading } = useWorkflowList()
  const deleteWorkflow = useWorkflowListStore((s) => s.deleteWorkflow)

  const [editing, setEditing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleNameClick = useCallback(() => {
    setEditing(true)
  }, [])

  const handleNameBlur = useCallback(() => {
    setEditing(false)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setEditing(false)
    }
  }, [])

  const stopNameInputEvent = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const statusText = [
    saving ? '同步中…' : isDirty ? '待同步' : '已同步',
    isPublished ? '已发布' : '未发布',
  ]
    .filter(Boolean)
    .join(' · ')

  const handleDeleteWorkflow = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const nextWorkflow = workflows.find((workflow) => workflow.id !== deleteTarget.id) ?? null
      await deleteWorkflow(deleteTarget.id)
      setDeleteTarget(null)
      if (activeWorkflowId === deleteTarget.id) {
        onWorkflowSelect?.(nextWorkflow?.id ?? null)
      }
    } finally {
      setDeleting(false)
    }
  }, [activeWorkflowId, deleteTarget, deleteWorkflow, onWorkflowSelect, workflows])

  const iconButton = useCallback(
    ({
      label,
      active,
      disabled,
      onClick,
      children,
    }: {
      label: string
      active?: boolean
      disabled?: boolean
      onClick?: () => void
      children: ReactNode
    }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="xs"
            className={cn('w-7 px-0', active && 'bg-primary/10 text-primary')}
            disabled={disabled}
            onClick={onClick}
            aria-label={label}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    ),
    [],
  )

  return (
    <>
      <div
        ref={toolbarRef}
        className={cn(
          'pointer-events-auto flex h-10 w-full min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-border bg-card/80 px-4 shadow-sm backdrop-blur',
        )}
      >
        {showWorkflowList && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 h-7 w-7"
                  aria-label="切换工作流"
                  title="切换工作流"
                >
                  <ListTree className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={12}
                alignOffset={-8}
                className="flex h-[320px] w-56 flex-col p-0"
              >
                <DropdownMenuLabel className="px-3 pt-3 text-xs text-muted-foreground">
                  工作流
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <ScrollArea className="min-h-0 flex-1">
                  <div className="p-1">
                    {workflowsLoading ? (
                      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                        加载中…
                      </div>
                    ) : workflows.length === 0 ? (
                      <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                        暂无工作流
                      </div>
                    ) : (
                      workflows.map((workflow) => {
                        const active = workflow.id === activeWorkflowId
                        return (
                          <DropdownMenuItem
                            key={workflow.id}
                            className="group/workflow-item cursor-pointer gap-2 pr-1"
                            onClick={() => onWorkflowSelect?.(workflow.id)}
                          >
                            <GitBranch className="h-4 w-4 text-primary" />
                            <span className="min-w-0 flex-1 truncate">{workflow.name}</span>
                            {active && <Check className="h-3.5 w-3.5 text-primary" />}
                            <button
                              type="button"
                              aria-label={`删除 ${workflow.name}`}
                              title="删除"
                              className="ml-1 hidden size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover/workflow-item:flex group-hover/workflow-item:opacity-100 focus:flex focus:opacity-100"
                              onClick={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                setDeleteTarget({ id: workflow.id, name: workflow.name })
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuItem>
                        )
                      })
                    )}
                  </div>
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="h-5 w-px shrink-0 bg-border" />
          </>
        )}

        <div className="flex min-w-0 flex-1 items-center gap-3">
          {editing ? (
            <Input
              ref={inputRef}
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleKeyDown}
              onPointerDown={stopNameInputEvent}
              onClick={stopNameInputEvent}
              className="h-7 min-w-24 max-w-48 flex-1 text-sm font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={handleNameClick}
              className="min-w-4 max-w-[200px] shrink truncate text-left text-sm font-medium text-foreground hover:text-muted-foreground"
            >
              {workflowName || '未命名工作流'}
            </button>
          )}

          <span
            className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
            title={statusText}
          >
            {statusText}
          </span>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {iconButton({
            label: '日志',
            active: logOpen,
            onClick: toggleLogOpen,
            children: <ScrollText className="h-3.5 w-3.5" />,
          })}
          {iconButton({
            label: '变量',
            active: utilityPanel === 'variables',
            onClick: () => toggleUtilityPanel('variables'),
            children: <Variable className="h-3.5 w-3.5" />,
          })}
          {iconButton({
            label: '预览',
            disabled: !isPublished,
            children: <Eye className="h-3.5 w-3.5" />,
          })}
          {iconButton({
            label: '快照',
            active: utilityPanel === 'snapshots',
            disabled: !activeWorkflowId,
            onClick: () => toggleUtilityPanel('snapshots'),
            children: <History className="h-3.5 w-3.5" />,
          })}
          <Button size="xs" onClick={onPublish} disabled={publishing || !activeWorkflowId}>
            <Rocket className="mr-1" />
            <span>{publishing ? '发布中…' : '发布'}</span>
          </Button>
        </div>
      </div>
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

HeaderBar.displayName = 'HeaderBar'

export { HeaderBar }
export type { HeaderBarProps }
