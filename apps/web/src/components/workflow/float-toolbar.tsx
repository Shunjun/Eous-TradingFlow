import { useState, useRef, useCallback, useEffect } from 'react'
import { Eye, Rocket, Save, ScrollText } from 'lucide-react'
import { Button, Input, cn } from '@eous/ui'
import { useWorkflowStore } from '../../stores/workflow'

interface FloatToolbarProps {
  saving: boolean
  publishing: boolean
  isLocalDraft: boolean
  logOpen: boolean
  onSave: () => void
  onPublish: () => void
  onToggleLog: () => void
}

function FloatToolbar({ saving, publishing, isLocalDraft, logOpen, onSave, onPublish, onToggleLog }: FloatToolbarProps) {
  const workflowName = useWorkflowStore((s) => s.workflowName)
  const isDirty = useWorkflowStore((s) => s.isDirty)
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName)
  const activeWorkflowId = useWorkflowStore((s) => s.activeWorkflowId)

  const [editing, setEditing] = useState(false)
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

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-4 right-4 top-3 z-10 flex h-10 items-center gap-3 rounded-lg border border-border bg-card/80 px-4 shadow-sm backdrop-blur',
      )}
    >
      {editing ? (
        <Input
          ref={inputRef}
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          onBlur={handleNameBlur}
          onKeyDown={handleKeyDown}
          className="h-7 w-48 text-sm font-medium"
        />
      ) : (
        <button
          type="button"
          onClick={handleNameClick}
          className="max-w-[200px] truncate text-sm font-medium text-foreground hover:text-muted-foreground"
        >
          {workflowName || '未命名工作流'}
        </button>
      )}

      <span className="text-xs text-muted-foreground">
        {saving ? '保存中…' : isDirty ? '未保存' : 'Auto-saved'}
      </span>
      {isLocalDraft && (
        <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
          本地版本
        </span>
      )}
      <span className="text-xs text-muted-foreground">{isPublished ? '已发布' : '未发布'}</span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleLog}
          className={cn(logOpen && 'bg-accent text-accent-foreground')}
        >
          <ScrollText className="mr-1.5 h-3.5 w-3.5" />
          日志
        </Button>
        <Button variant="outline" size="sm" disabled={!isPublished}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          预览
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSave}
          disabled={saving || !activeWorkflowId}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {saving ? '保存中…' : '保存'}
        </Button>
        <Button size="sm" onClick={onPublish} disabled={publishing || !activeWorkflowId}>
          <Rocket className="mr-1.5 h-3.5 w-3.5" />
          {publishing ? '发布中…' : '发布'}
        </Button>
      </div>
    </div>
  )
}

FloatToolbar.displayName = 'FloatToolbar'

export { FloatToolbar }
export type { FloatToolbarProps }
