import { Handle, Position } from '@xyflow/react'
import { cn, Dot } from '@eous/ui'
import type { NodeComponentProps, NodeMeta, OutputField, ParamDef } from '../types'

const meta: NodeMeta = {
  type: 'control.branch',
  category: 'control',
  label: '条件分支',
  icon: 'git-branch',
  description: '根据条件选择执行路径',
}

const executeInput: Record<string, ParamDef> = {
  condition: {
    type: 'string',
    from: 'panel',
    required: true,
    description: '条件表达式，如 {{signal.signal}} === "long"',
  },
  trueValue: {
    type: 'string',
    from: 'panel',
    description: '条件为 true 时传递给下游的值',
  },
  falseValue: {
    type: 'string',
    from: 'panel',
    description: '条件为 false 时传递给下游的值',
  },
}

const executeOutput: Record<string, OutputField> = {
  result: {
    name: 'result',
    type: 'boolean',
    source: { field: 'result' },
    description: '条件判断结果',
  },
  value: {
    name: 'value',
    type: 'string',
    source: { field: 'value' },
    description: '根据条件选择的值',
  },
}

const handleBase = '!h-2.5 !w-2.5 !rounded-full !border-2 !border-violet-500 !bg-background'

function CanvasNode({ data, selected, status = 'idle' }: NodeComponentProps) {
  const condition = typeof data.condition === 'string' ? data.condition : ''

  return (
    <div
      className={cn(
        'w-52 rounded-lg border border-border bg-card shadow-sm',
        selected && 'ring-2 ring-primary',
      )}
    >
      <div className="flex items-center gap-2 rounded-t-lg bg-violet-500 px-3 py-2">
        <span className="text-xs font-medium text-white">条件</span>
        {status !== 'idle' && (
          <Dot
            size="xs"
            variant={status === 'running' ? 'pulse' : 'static'}
            className={cn(
              'ml-auto',
              status === 'running' && 'bg-white',
              status === 'completed' && 'bg-emerald-300',
              status === 'failed' && 'bg-red-300',
            )}
          />
        )}
      </div>

      <div className="flex flex-col items-center gap-2 px-3 py-3">
        <svg
          className="h-6 w-6 text-violet-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="6" y1="3" x2="6" y2="15" />
          <circle cx="18" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M18 9a9 9 0 0 1-9 9" />
        </svg>

        {condition ? (
          <span className="w-full truncate rounded bg-muted px-2 py-0.5 text-center font-mono text-[10px] text-muted-foreground">
            {condition}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground/60">设置条件…</span>
        )}
      </div>

      <Handle type="target" position={Position.Left} className={handleBase} />
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        className={cn(handleBase, '!top-[33%]')}
      />
      <span className="pointer-events-none absolute right-[-2px] top-[calc(33%+8px)] text-[9px] font-medium text-emerald-500">
        T
      </span>
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        className={cn(handleBase, '!top-[66%]')}
      />
      <span className="pointer-events-none absolute right-[-2px] top-[calc(66%+8px)] text-[9px] font-medium text-red-400">
        F
      </span>
    </div>
  )
}

CanvasNode.displayName = 'CanvasNode'

export { CanvasNode, meta, executeInput, executeOutput }
