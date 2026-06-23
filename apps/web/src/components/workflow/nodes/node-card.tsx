import type { NodeCanvasViewRow } from '@eous/nodes'
import { NodeHandle, type NodeHandleProps } from './node-handle'

type NodeConnection = {
  target?: boolean
  source?: boolean
}

const NODE_ICON_LABELS: Record<string, string> = {
  brain: 'AI',
  'candlestick-chart': 'K',
  'dollar-sign': '$',
  'file-text': 'R',
  'git-branch': 'IF',
  'message-square': 'LLM',
}

interface NodeTitleProps {
  nodeId: string
  icon: string
  title: string
  color?: string
  connection?: NodeConnection
  onAddConnectedNode?: NodeHandleProps['onAddConnectedNode']
}

function NodeTitle({ nodeId, icon, title, color, connection, onAddConnectedNode }: NodeTitleProps) {
  const iconLabel = NODE_ICON_LABELS[icon] ?? 'N'

  return (
    <div className="relative flex min-h-9 items-center gap-2 border-b border-border/80 px-2.5">
      {connection?.target ? <NodeHandle nodeId={nodeId} handleId="target" type="target" /> : null}
      <div
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted/55 text-foreground"
        style={
          color ? { color, backgroundColor: `${color}14`, borderColor: `${color}33` } : undefined
        }
      >
        <span className="text-[9px] font-bold leading-none">{iconLabel}</span>
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-semibold leading-4 text-foreground">{title}</div>
      </div>
      {connection?.source ? (
        <NodeHandle
          nodeId={nodeId}
          handleId="source"
          type="source"
          onAddConnectedNode={onAddConnectedNode}
        />
      ) : null}
    </div>
  )
}

interface NodeDetailRowProps {
  nodeId: string
  row: NodeCanvasViewRow
  onAddConnectedNode?: NodeHandleProps['onAddConnectedNode']
}

function NodeDetailRow({ nodeId, row, onAddConnectedNode }: NodeDetailRowProps) {
  return (
    <div className="relative grid grid-cols-[58px_minmax(0,1fr)] gap-2 px-2.5 py-1.5">
      {row.field && row.target ? (
        <NodeHandle nodeId={nodeId} handleId={row.field} type="target" variant="detail" />
      ) : null}
      <span className="truncate text-[10px] font-medium uppercase leading-4 text-muted-foreground">
        {row.label}
      </span>
      <span className="truncate text-right font-mono text-[10px] leading-4 text-foreground/85">
        {row.value}
      </span>
      {row.field && row.source ? (
        <NodeHandle
          nodeId={nodeId}
          handleId={row.field}
          type="source"
          variant="detail"
          onAddConnectedNode={onAddConnectedNode}
        />
      ) : null}
    </div>
  )
}

interface NodeCardProps {
  nodeId: string
  icon: string
  title: string
  color?: string
  rows: NodeCanvasViewRow[]
  connection?: NodeConnection
  onAddConnectedNode?: NodeHandleProps['onAddConnectedNode']
}

function NodeCard({
  nodeId,
  icon,
  title,
  color,
  rows,
  connection,
  onAddConnectedNode,
}: NodeCardProps) {
  return (
    <div className="w-[220px] overflow-visible rounded-[10px] bg-card">
      <NodeTitle
        nodeId={nodeId}
        icon={icon}
        title={title}
        color={color}
        connection={connection}
        onAddConnectedNode={onAddConnectedNode}
      />
      <div className="divide-y divide-border/60">
        {rows.map((row) => (
          <NodeDetailRow
            key={row.field ?? row.label}
            nodeId={nodeId}
            row={row}
            onAddConnectedNode={onAddConnectedNode}
          />
        ))}
      </div>
    </div>
  )
}

export { NodeCard, NodeDetailRow, NodeTitle }
export type { NodeCardProps, NodeDetailRowProps, NodeTitleProps }
