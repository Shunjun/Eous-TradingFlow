import { useState, useMemo, useCallback } from 'react'
import { Plus, Pin, PinOff } from 'lucide-react'
import {
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Separator,
  ScrollArea,
  cn,
} from '@eous/ui'
import { allNodeMetas, type NodeMeta } from '@eous/nodes'

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
}

function NodeSelector({ onSelectNode }: NodeSelectorProps) {
  const [search, setSearch] = useState('')
  const [pinned, setPinned] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)

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
      setPopoverOpen(false)
      setSearch('')
    },
    [onSelectNode],
  )

  const handleTogglePin = useCallback(() => {
    setPinned((prev) => !prev)
    setPopoverOpen(false)
    setSearch('')
  }, [])

  const nodeList = (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-2">
        <Input
          placeholder="搜索…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="px-3 pb-3">
          {CATEGORY_ORDER.map((category) => {
            const nodes = groups.get(category)
            if (!nodes || nodes.length === 0) return null
            return (
              <div key={category} className="mb-3">
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {CATEGORY_LABELS[category] ?? category}
                </p>
                <div className="flex flex-col gap-0.5">
                  {nodes.map((node) => (
                    <button
                      key={node.type}
                      type="button"
                      onClick={() => handleSelect(node.type)}
                      className="rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                    >
                      {node.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {groups.size === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">无匹配节点</p>
          )}
        </div>
      </ScrollArea>
      <Separator />
      <button
        type="button"
        onClick={handleTogglePin}
        className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
        {pinned ? '取消固定' : '📌 固定到左侧'}
      </button>
    </div>
  )

  if (pinned) {
    return (
      <div
        className={cn(
          'pointer-events-auto absolute bottom-3 left-3 top-16 z-10 w-[220px] overflow-hidden rounded-lg border-r border-border bg-card/90 shadow-sm backdrop-blur',
          'animate-in slide-in-from-left duration-300',
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-3 py-2">
            <span className="text-xs font-medium text-foreground">节点</span>
          </div>
          {nodeList}
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-16 z-10">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" className="h-9 w-9 rounded-full p-0 shadow-sm">
            <Plus className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="start"
          className="w-56 p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {nodeList}
        </PopoverContent>
      </Popover>
    </div>
  )
}

NodeSelector.displayName = 'NodeSelector'

export { NodeSelector }
export type { NodeSelectorProps }
