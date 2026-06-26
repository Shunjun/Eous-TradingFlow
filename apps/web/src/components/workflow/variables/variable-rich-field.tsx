import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Extension, mergeAttributes, Node, type JSONContent } from '@tiptap/core'
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  ReactRenderer,
  useEditor,
} from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { PluginKey } from '@tiptap/pm/state'
import {
  Suggestion,
  exitSuggestion,
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { getNodeDef, type ParamDef } from '@eous/nodes'
import { ScrollArea, cn } from '@eous/ui'
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

interface VariableSuggestionItem {
  refValue: VariableRef
  groupLabel: string
  hasValue: boolean
}

interface VariableSuggestionMenuHandle {
  onKeyDown: (event: KeyboardEvent) => boolean
}

interface VariableSuggestionMenuProps {
  items: VariableSuggestionItem[]
  command: (item: VariableSuggestionItem) => void
  loading: boolean
}

const VariableSuggestionPluginKey = new PluginKey('variableSuggestion')

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
        <NodeViewWrapper
          as="span"
          className="inline-flex align-text-bottom leading-none"
          contentEditable={false}
        >
          <VariableTag refValue={refValue} />
        </NodeViewWrapper>
      )
    })
  },
})

const VariableSuggestionMenu = forwardRef<
  VariableSuggestionMenuHandle,
  VariableSuggestionMenuProps
>(function VariableSuggestionMenu({ items, command, loading }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    setSelectedIndex(0)
  }, [items])

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown(event) {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelectedIndex((index) => (items.length === 0 ? 0 : (index + 1) % items.length))
          return true
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex((index) =>
            items.length === 0 ? 0 : (index - 1 + items.length) % items.length,
          )
          return true
        }
        if (event.key === 'Enter') {
          event.preventDefault()
          const item = items[selectedIndex]
          if (item) command(item)
          return true
        }
        return false
      },
    }),
    [command, items, selectedIndex],
  )

  let previousGroup = ''

  return (
    <div className="w-60 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
      <div className="border-b border-border px-2 py-1.5 text-[10px] text-muted-foreground">
        选择变量
      </div>
      <ScrollArea className="max-h-64">
        <div className="p-1">
          {loading ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">加载中…</div>
          ) : items.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-muted-foreground">无可用变量</div>
          ) : (
            items.map((item, index) => {
              const showGroup = item.groupLabel !== previousGroup
              previousGroup = item.groupLabel

              return (
                <div key={`${item.refValue.nodeId}-${item.refValue.fieldName}`}>
                  {showGroup && (
                    <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
                      {item.groupLabel}
                    </div>
                  )}
                  <button
                    type="button"
                    className={cn(
                      'flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted',
                      index === selectedIndex && 'bg-muted',
                    )}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      command(item)
                    }}
                  >
                    <VariableTag refValue={item.refValue} className="min-w-0 flex-1" />
                    <span
                      className={cn(
                        'shrink-0 text-[10px]',
                        item.hasValue ? 'text-muted-foreground' : 'text-muted-foreground/60',
                      )}
                    >
                      {item.refValue.fieldType}
                    </span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
})

function createVariableSuggestionExtension(
  itemsRef: React.MutableRefObject<VariableSuggestionItem[]>,
) {
  return Extension.create({
    name: 'variableSuggestion',

    addProseMirrorPlugins() {
      return [
        Suggestion<VariableSuggestionItem, VariableSuggestionItem>({
          editor: this.editor,
          pluginKey: VariableSuggestionPluginKey,
          char: '/',
          allowSpaces: false,
          allowedPrefixes: null,
          placement: 'bottom-start',
          items: ({ query }) => {
            const normalizedQuery = query.trim().toLowerCase()
            if (!normalizedQuery) return itemsRef.current
            return itemsRef.current.filter((item) => {
              const label = `${item.refValue.nodeLabel}.${item.refValue.fieldName}`.toLowerCase()
              return label.includes(normalizedQuery)
            })
          },
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent({
                type: 'variableRef',
                attrs: {
                  nodeId: props.refValue.nodeId,
                  fieldName: props.refValue.fieldName,
                },
              })
              .insertContent(' ')
              .run()
          },
          render: () => {
            let component: ReactRenderer<
              VariableSuggestionMenuHandle,
              VariableSuggestionMenuProps
            > | null = null
            let popup: TippyInstance | null = null

            const updatePopup = (
              props: SuggestionProps<VariableSuggestionItem, VariableSuggestionItem>,
            ) => {
              if (!popup || !props.clientRect) return
              popup.setProps({
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
              })
            }

            return {
              onStart: (props) => {
                component = new ReactRenderer(VariableSuggestionMenu, {
                  editor: props.editor,
                  props: {
                    items: props.items,
                    command: props.command,
                    loading: props.loading,
                  },
                })

                popup = tippy(document.body, {
                  getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: props.placement,
                  offset: [props.offset.crossAxis, props.offset.mainAxis],
                  hideOnClick: true,
                  onClickOutside: () => {
                    exitSuggestion(props.editor.view, VariableSuggestionPluginKey)
                  },
                })
              },
              onUpdate: (props) => {
                component?.updateProps({
                  items: props.items,
                  command: props.command,
                  loading: props.loading,
                })
                updatePopup(props)
              },
              onKeyDown: ({ event, view }: SuggestionKeyDownProps) => {
                if (event.key === 'Escape') {
                  exitSuggestion(view, VariableSuggestionPluginKey)
                  return true
                }
                return component?.ref?.onKeyDown(event) ?? false
              },
              onExit: () => {
                popup?.destroy()
                component?.destroy()
                popup = null
                component = null
              },
            }
          },
        }),
      ]
    },
  })
}

function VariableRichField({
  param,
  value,
  onChange,
  nodeId,
  upstreamOutputs,
  multiline = false,
}: VariableRichFieldProps) {
  const storeNodes = useWorkflowStore((state) => state.nodes)
  const edges = useWorkflowStore((state) => state.edges)
  const textValue = String(value ?? param.default ?? '')
  const initialContent = useMemo(() => textToDoc(textValue), [])
  const variableItemsRef = useRef<VariableSuggestionItem[]>([])
  const variableSuggestionExtension = useMemo(
    () => createVariableSuggestionExtension(variableItemsRef),
    [],
  )
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

  variableItemsRef.current = variableGroups.flatMap((group) =>
    group.fields.map((field) => ({
      refValue: {
        nodeId: group.nodeId,
        nodeLabel: group.nodeLabel,
        fieldName: field.name,
        fieldType: field.type,
      },
      groupLabel: group.nodeLabel,
      hasValue: field.hasValue,
    })),
  )

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
      variableSuggestionExtension,
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: cn(
          'min-h-full break-words leading-7 outline-none',
          multiline ? 'whitespace-pre-wrap' : 'whitespace-nowrap',
        ),
      },
      handleKeyDown: (view, event) => {
        if (!multiline && event.key === 'Enter') return true
        return false
      },
    },
    onUpdate: ({ editor }) => {
      onChange(docToText(editor.getJSON()))
    },
  })

  useEffect(() => {
    if (!editor) return
    const next = textToDoc(textValue)
    if (docToText(editor.getJSON()) !== textValue) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, textValue])

  return (
    <div>
      <div
        className={cn(
          'cursor-text rounded-md border border-border bg-background px-2 py-1.5 text-xs focus-within:ring-1 focus-within:ring-ring',
          multiline ? 'min-h-24 resize-y overflow-auto' : 'min-h-8 overflow-hidden',
        )}
        aria-label={param.label ?? param.description}
        onMouseDown={(event) => {
          const target = event.target as HTMLElement
          if (!target.closest('.ProseMirror')) {
            event.preventDefault()
            editor?.chain().focus('end').run()
          }
        }}
        onClick={() => editor?.chain().focus().run()}
      >
        <EditorContent editor={editor} className="min-h-full cursor-text" />
      </div>
    </div>
  )
}

export { VariableRichField, VariableRefNode, docToText, textToDoc }
export type { VariableRichFieldProps }
