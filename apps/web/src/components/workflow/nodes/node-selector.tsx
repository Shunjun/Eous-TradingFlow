import { useState, useMemo, useCallback, type ReactNode } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
} from '@eous/ui'
import { allNodeMetas, type NodeMeta } from '@eous/nodes'
import { NodeIcon } from './node-icons'

const CATEGORY_LABELS: Record<string, string> = {
  source: '数据源',
  compute: '计算',
  llm: 'LLM',
  control: '控制',
  output: '输出',
  agent: '智能体',
}

const CATEGORY_ORDER = ['source', 'compute', 'llm', 'control', 'output', 'agent'] as const

const allNodes: NodeMeta[] = allNodeMetas

function groupByCategory(nodes: NodeMeta[]) {
  const groups = new Map<string, NodeMeta[]>()
  for (const node of nodes) {
    const list = groups.get(node.category) ?? []
    list.push(node)
    groups.set(node.category, list)
  }
  return groups
}

interface NodeSelectorProps {
  onSelectNode: (nodeType: string) => void
  children?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  alignOffset?: number
}

function NodeSelector({
  onSelectNode,
  children,
  open: controlledOpen,
  onOpenChange,
  side = 'right',
  align = 'start',
  sideOffset = 8,
  alignOffset = -4,
}: NodeSelectorProps) {
  const [search, setSearch] = useState('')
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen

  const setOpen = useCallback(
    (nextOpen: boolean) => {
      onOpenChange?.(nextOpen)
      if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    },
    [controlledOpen, onOpenChange],
  )

  const filtered = useMemo(() => {
    if (!search.trim()) return allNodes
    const q = search.toLowerCase()
    return allNodes.filter(
      (n) => n.label.toLowerCase().includes(q) || n.type.toLowerCase().includes(q),
    )
  }, [search])

  const groups = useMemo(() => groupByCategory(filtered), [filtered])

  const handleSelect = useCallback(
    (nodeType: string) => {
      onSelectNode(nodeType)
      setOpen(false)
      setSearch('')
    },
    [onSelectNode],
  )

  const nodeList = (
    <>
      <div className="p-2">
        <Input
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <DropdownMenuSeparator />
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-1">
          {CATEGORY_ORDER.map((category) => {
            const nodes = groups.get(category)
            if (!nodes || nodes.length === 0) return null
            return (
              <div key={category}>
                <DropdownMenuLabel className="px-2 py-1 text-[11px] text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </DropdownMenuLabel>
                {nodes.map((node) => (
                  <DropdownMenuItem
                    key={node.type}
                    onSelect={() => handleSelect(node.type)}
                    className="gap-2 text-xs"
                  >
                    <NodeIcon name={node.icon} className="h-3.5 w-3.5" />
                    <span className="flex-1 truncate">{node.label}</span>
                    <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                      {node.type}
                    </span>
                  </DropdownMenuItem>
                ))}
                {category !== CATEGORY_ORDER[CATEGORY_ORDER.length - 1] && (
                  <DropdownMenuSeparator />
                )}
              </div>
            )
          })}
          {groups.size === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">无匹配节点</p>
          )}
        </div>
      </ScrollArea>
    </>
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {children ? <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger> : null}
      <DropdownMenuContent
        side={side}
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        className="flex w-56 h-[360px] flex-col p-0"
      >
        {nodeList}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

NodeSelector.displayName = 'NodeSelector'

export { NodeSelector }
export type { NodeSelectorProps }
