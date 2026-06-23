import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Check,
  Ellipsis,
  Eye,
  GitBranch,
  ListTree,
  Rocket,
  Save,
  ScrollText,
  Trash2,
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
  cn,
} from '@eous/ui'
import { useWorkflowList } from '../../../hooks/use-workflows'
import { useWorkflowListStore } from '../../../stores/workflows'
import { useWorkflowStore } from '../store/workflow-store'

const COMPACT_ACTIONS_WIDTH = 640

interface FloatToolbarProps {
  saving: boolean
  publishing: boolean
  isLocalDraft: boolean
  logOpen: boolean
  showWorkflowList?: boolean
  onSave: () => void
  onPublish: () => void
  onToggleLog: () => void
  onWorkflowSelect?: (workflowId: string | null) => void
}

function FloatToolbar({
  saving,
  publishing,
  isLocalDraft,
  logOpen,
  showWorkflowList = false,
  onSave,
  onPublish,
  onToggleLog,
  onWorkflowSelect,
}: FloatToolbarProps) {
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const isDirty = useWorkflowStore((s) => s.isDirty)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)
  const { workflows, loading: workflowsLoading } = useWorkflowList()
  const deleteWorkflow = useWorkflowListStore((s) => s.deleteWorkflow)

  const [editing, setEditing] = useState(false)
  const [compactActions, setCompactActions] = useState(false)
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

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const isPublished = activeWorkflowId && activeWorkflowId !== 'new'
  const statusText = [
    saving ? '保存中…' : isDirty ? '未保存' : 'Auto-saved',
    isLocalDraft ? '本地版本' : null,
    isPublished ? '已发布' : '未发布',
  ]
    .filter(Boolean)
    .join(' · ')

  useEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      setCompactActions(entry.contentRect.width < COMPACT_ACTIONS_WIDTH)
    })

    resizeObserver.observe(toolbar)
    return () => resizeObserver.disconnect()
  }, [])

  const saveButton = (
    <Button
      variant="outline"
      size="xs"
      className="shrink-0"
      onClick={onSave}
      disabled={saving || !activeWorkflowId}
    >
      <Save className="mr-1" />
      <span>{saving ? '保存中…' : '保存'}</span>
    </Button>
  )

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
              className="h-7 min-w-24 max-w-48 flex-1 text-sm font-medium"
            />
          ) : (
            <button
              type="button"
              onClick={handleNameClick}
              className="min-w-16 max-w-[200px] shrink truncate text-left text-sm font-medium text-foreground hover:text-muted-foreground"
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
          {compactActions ? (
            <>
              {saveButton}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="xs" className="w-7 px-0" aria-label="更多操作">
                    <Ellipsis className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem className="cursor-pointer gap-2" onClick={onToggleLog}>
                    <ScrollText className="h-4 w-4" />
                    <span className="flex-1">日志</span>
                    {logOpen && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer gap-2" disabled={!isPublished}>
                    <Eye className="h-4 w-4" />
                    预览
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer gap-2"
                    disabled={publishing || !activeWorkflowId}
                    onClick={onPublish}
                  >
                    <Rocket className="h-4 w-4" />
                    {publishing ? '发布中…' : '发布'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="xs"
                onClick={onToggleLog}
                className={cn(logOpen && 'bg-accent text-accent-foreground')}
              >
                <ScrollText className="mr-1" />
                日志
              </Button>
              <Button variant="outline" size="xs" disabled={!isPublished}>
                <Eye className="mr-1" />
                <span>预览</span>
              </Button>
              {saveButton}
              <Button size="xs" onClick={onPublish} disabled={publishing || !activeWorkflowId}>
                <Rocket className="mr-1" />
                <span>{publishing ? '发布中…' : '发布'}</span>
              </Button>
            </>
          )}
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

FloatToolbar.displayName = 'FloatToolbar'

export { FloatToolbar }
export type { FloatToolbarProps }
