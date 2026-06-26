import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mergeAttributes, Node, type JSONContent } from '@tiptap/core'
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { getNodeDef, type ParamDef } from '@eous/nodes'
import { Badge, ScrollArea, cn } from '@eous/ui'
import { useWorkflowStore } from '../store/workflow-store'
import { getEffectiveOutputs } from '../panels/settings-panel-outputs'
import { VariableTag } from './variable-tag'
import { EMBEDDED_VAR_PATTERN, formatVariableRef, parseVariableRef } from './variable-ref'
import type { VariableRef } from './variable-picker'

interface VariableRichFieldProps {
  param: ParamDef
  value: unknown
  onChange: (value: unknown) => void
  nodeId: string
  upstreamOutputs: Record<string, Record<string, unknown>>
  multiline?: boolean
}

function variableRefToAttrs(value: string): { nodeId: string; fieldName: string } | null {
  const parsed = parseVariableRef(value)
  if (!parsed) return null
  return { nodeId: parsed.nodeId, fieldName: parsed.fieldName }
}

function textToInlineContent(value: string): JSONContent[] {
  const content: JSONContent[] = []
  let cursor = 0

  for (const match of value.matchAll(EMBEDDED_VAR_PATTERN)) {
    const raw = match[0]
    const offset = match.index ?? 0
    if (offset > cursor) {
      content.push({ type: 'text', text: value.slice(cursor, offset) })
    }
    const attrs = variableRefToAttrs(raw)
    if (attrs) {
      content.push({ type: 'variableRef', attrs })
    } else {
      content.push({ type: 'text', text: raw })
    }
    cursor = offset + raw.length
  }

  if (cursor < value.length) {
    content.push({ type: 'text', text: value.slice(cursor) })
  }

  return content
}

function textToDoc(value: string): JSONContent {
  const lines = value.split('\n')

  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: textToInlineContent(line),
    })),
  }
}

function docToText(doc: JSONContent): string {
  function serialize(node: JSONContent): string {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'variableRef') {
      const nodeId = typeof node.attrs?.nodeId === 'string' ? node.attrs.nodeId : ''
      const fieldName = typeof node.attrs?.fieldName === 'string' ? node.attrs.fieldName : ''
      if (!nodeId || !fieldName) return ''
      return formatVariableRef({ nodeId, fieldName, nodeLabel: nodeId, fieldType: '' })
    }
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'paragraph') return (node.content ?? []).map(serialize).join('')
    return (node.content ?? []).map(serialize).join('')
  }

  return (doc.content ?? []).map(serialize).join('\n')
}

const VariableRefNode = Node.create({
  name: 'variableRef',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      nodeId: { default: '' },
      fieldName: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-variable-ref]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-variable-ref': '' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(({ node }) => {
      const nodeId = typeof node.attrs.nodeId === 'string' ? node.attrs.nodeId : ''
      const fieldName = typeof node.attrs.fieldName === 'string' ? node.attrs.fieldName : ''
      const refValue: VariableRef = { nodeId, fieldName, nodeLabel: nodeId, fieldType: '' }
      return (
        <NodeViewWrapper as="span" className="inline-flex align-middle" contentEditable={false}>
          <VariableTag refValue={refValue} />
        </NodeViewWrapper>
      )
    })
  },
})

function VariableRichField({
  param,
  value,
  onChange,
  nodeId,
  upstreamOutputs,
  multiline = false,
}: VariableRichFieldProps) {
  const [variableMenuOpen, setVariableMenuOpen] = useState(false)
  const slashRangeRef = useRef<{ from: number; to: number } | null>(null)
  const storeNodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const textValue = String(value ?? param.default ?? '')
  const initialContent = useMemo(() => textToDoc(textValue), [])
  const variableGroups = useMemo(() => {
    const upstreamIds = new Set<string>()
    for (const edge of edges) {
      if (edge.target === nodeId) upstreamIds.add(edge.source)
    }

    return Array.from(upstreamIds)
      .map((id) => {
        const node = storeNodes.find((item) => item.id === id)
        const nodeLabel = node
          ? typeof node.data.label === 'string'
            ? node.data.label
            : (node.type ?? id)
          : id
        const outputs = getEffectiveOutputs(node?.data ?? {}, getNodeDef(node?.type ?? ''))
          .filter((field) => {
            if (!param.acceptTypes?.length) return true
            const type = field.type.toLowerCase()
            if (param.acceptTypes.includes('number') && type === 'number') return true
            if (param.acceptTypes.includes('boolean') && type === 'boolean') return true
            if (
              param.acceptTypes.includes('array') &&
              (type.includes('array') || type.endsWith('[]'))
            ) {
              return true
            }
            if (param.acceptTypes.includes('object') && (type === 'object' || type === 'json')) {
              return true
            }
            return param.acceptTypes.includes('string')
          })
          .map((field) => ({
            name: field.name,
            type: field.type,
            hasValue: Object.prototype.hasOwnProperty.call(upstreamOutputs[id] ?? {}, field.name),
          }))

        return { nodeId: id, nodeLabel, fields: outputs }
      })
      .filter((group) => group.fields.length > 0)
  }, [edges, nodeId, param.acceptTypes, storeNodes, upstreamOutputs])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      VariableRefNode,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-full break-words outline-none [&_.ProseMirror-p]:m-0',
          multiline ? 'whitespace-pre-wrap' : 'whitespace-nowrap',
        ),
      },
      handleKeyDown: (view, event) => {
        if (!multiline && event.key === 'Enter') return true
        if (event.key === '/') {
          const from = view.state.selection.from
          slashRangeRef.current = { from, to: from + 1 }
          window.setTimeout(() => setVariableMenuOpen(true), 0)
          return false
        }
        if (event.key === 'Escape') {
          setVariableMenuOpen(false)
          slashRangeRef.current = null
        }
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange(docToText(editor.getJSON()))
    },
  })

  const insertVariable = useCallback(
    (ref: VariableRef) => {
      if (!editor) return

      const range = slashRangeRef.current
      const chain = editor.chain().focus()
      if (range) chain.deleteRange(range)
      chain
        .insertContent({
          type: 'variableRef',
          attrs: { nodeId: ref.nodeId, fieldName: ref.fieldName },
        })
        .insertContent(' ')
        .run()
      slashRangeRef.current = null
      setVariableMenuOpen(false)
    },
    [editor],
  )

  useEffect(() => {
    if (!editor) return
    const next = textToDoc(textValue)
    if (docToText(editor.getJSON()) !== textValue) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, textValue])

  return (
    <div className="relative">
      <div
        className={cn(
          'rounded-md border border-border bg-background px-2 py-1.5 text-xs focus-within:ring-1 focus-within:ring-ring',
          multiline ? 'min-h-24 resize-y overflow-auto' : 'min-h-8 overflow-hidden',
        )}
        aria-label={param.label ?? param.description}
      >
        <EditorContent editor={editor} />
      </div>
      {variableMenuOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          <div className="border-b border-border px-2 py-1.5 text-[10px] text-muted-foreground">
            选择变量
          </div>
          <ScrollArea className="max-h-56">
            <div className="p-1">
              {variableGroups.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                  无可用变量
                </div>
              ) : (
                variableGroups.map((group) => (
                  <div key={group.nodeId} className="mb-1">
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                      {group.nodeLabel}
                    </div>
                    {group.fields.map((field) => (
                      <button
                        key={`${group.nodeId}-${field.name}`}
                        type="button"
                        className="flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-accent/70"
                        onMouseDown={(event) => {
                          event.preventDefault()
                          insertVariable({
                            nodeId: group.nodeId,
                            nodeLabel: group.nodeLabel,
                            fieldName: field.name,
                            fieldType: field.type,
                          })
                        }}
                      >
                        <VariableTag
                          refValue={{
                            nodeId: group.nodeId,
                            nodeLabel: group.nodeLabel,
                            fieldName: field.name,
                            fieldType: field.type,
                          }}
                          className="min-w-0 flex-1"
                        />
                        <Badge
                          variant={field.hasValue ? 'secondary' : 'outline'}
                          className="text-[10px]"
                        >
                          {field.type}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}

export { VariableRichField, VariableRefNode, docToText, textToDoc }
export type { VariableRichFieldProps }
