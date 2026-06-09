import { Handle, Position } from '@xyflow/react'
import { cn } from '@eous/ui'

interface BaseNodeProps {
  id: string
  data: { color?: string; label?: string; status?: string }
  selected: boolean
  hideHandles?: boolean
  children: React.ReactNode
}

const handleClassName = '!h-2 !w-2 !rounded-full !border-2 !border-border !bg-background'

function BaseNode({ id, data, selected, hideHandles, children }: BaseNodeProps) {
  return (
    <div
      className={cn(
        'relative rounded-lg border border-border bg-card shadow-sm',
        selected && 'ring-2 ring-primary',
      )}
    >
      {data.color && (
        <div
          className="absolute bottom-0 left-0 top-0 w-1 rounded-l-lg"
          style={{ backgroundColor: data.color }}
        />
      )}
      <div className={cn(data.color && 'pl-1.5')}>{children}</div>
      {!hideHandles && (
        <>
          <Handle type="target" position={Position.Left} className={handleClassName} />
          <Handle type="source" position={Position.Right} className={handleClassName} />
        </>
      )}
    </div>
  )
}

BaseNode.displayName = 'BaseNode'

export { BaseNode }
export type { BaseNodeProps }
