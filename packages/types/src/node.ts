import type { NodeCategory, NodeType } from './workflow.js'

export interface NodeDataBase {
  label: string
  description?: string
}

export interface InputHandleDef {
  id: string
  label: string
}

export interface OutputHandleDef {
  id: string
  label: string
}

export interface NodeTypeMeta {
  type: NodeType
  category: NodeCategory
  label: string
  description: string
  icon: string
}
