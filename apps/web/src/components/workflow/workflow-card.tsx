import { GitBranch } from 'lucide-react'

interface WorkflowCardProps {
  name: string
  nodeCount: number
  updatedAt: string
  onClick: () => void
}

export function WorkflowCard({ name, nodeCount, updatedAt, onClick }: WorkflowCardProps) {
  const date = updatedAt ? new Date(updatedAt).toLocaleDateString('zh-CN') : '--'

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{nodeCount} 个节点</span>
        <span>{date}</span>
      </div>
    </button>
  )
}
