import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
} from '@eous/ui'
import { createWorkflow } from '../../../hooks/use-workflows'

interface CreateWorkflowDialogProps {
  open: boolean
  onCreated: (id: string) => void
  onCancel: () => void
}

function CreateWorkflowDialog({ open, onCreated, onCancel }: CreateWorkflowDialogProps) {
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = name.trim()
      if (!trimmed) return

      setCreating(true)
      setError(null)
      try {
        const id = await createWorkflow(trimmed)
        onCreated(id)
      } catch (err) {
        setError(err instanceof Error ? err.message : '创建失败')
      } finally {
        setCreating(false)
      }
    },
    [name, onCreated],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel()
      }}
    >
      <DialogContent showCloseButton={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>新建工作流</DialogTitle>
            <DialogDescription>输入工作流名称开始创建</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="工作流名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              disabled={creating}
            />
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={creating}>
              取消
            </Button>
            <Button type="submit" disabled={!name.trim() || creating}>
              {creating ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

CreateWorkflowDialog.displayName = 'CreateWorkflowDialog'

export { CreateWorkflowDialog }
