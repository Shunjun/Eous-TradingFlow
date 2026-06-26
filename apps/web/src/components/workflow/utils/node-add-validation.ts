import type { Node } from '@xyflow/react'
import { toast } from '@eous/ui'

function validateCanAddNodeType(nodeType: string, nodes: Node[]): boolean {
  if (nodeType === 'trigger.start' && nodes.some((node) => node.type === 'trigger.start')) {
    toast.warning('一个工作流只能有一个开始节点')
    return false
  }

  return true
}

export { validateCanAddNodeType }
