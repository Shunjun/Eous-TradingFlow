import type { Edge, Node } from '@xyflow/react'
import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 220
const NODE_HEIGHT = 120
const RANK_SEP = 80
const NODE_SEP = 56

function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: 'LR',
    ranksep: RANK_SEP,
    nodesep: NODE_SEP,
  })

  for (const node of nodes) {
    const measured = node.measured
    graph.setNode(node.id, {
      width: measured?.width ?? node.width ?? NODE_WIDTH,
      height: measured?.height ?? node.height ?? NODE_HEIGHT,
    })
  }

  const nodeIds = new Set(nodes.map((node) => node.id))
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const layouted = graph.node(node.id)
    const width = layouted?.width ?? NODE_WIDTH
    const height = layouted?.height ?? NODE_HEIGHT
    return {
      ...node,
      position: {
        x: (layouted?.x ?? 0) - width / 2,
        y: (layouted?.y ?? 0) - height / 2,
      },
    }
  })
}

export { layoutNodes }
