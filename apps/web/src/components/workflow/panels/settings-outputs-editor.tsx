import { useCallback, useState } from 'react'
import { Check, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from '@eous/ui'
import type { CustomOutputDef, NodeDef } from '@eous/nodes'
import { getBaseOutputs, getCustomOutputs, OUTPUT_TYPES } from './settings-panel-outputs'

interface SettingsOutputsEditorProps {
  data: Record<string, unknown>
  nodeDef: NodeDef | undefined
  onChange: (data: Record<string, unknown>) => void
}

function createEmptyOutput(): CustomOutputDef {
  return {
    name: '',
    type: 'string',
    description: '',
    expression: '',
  }
}

function normalizeOutputName(name: string) {
  return name.trim()
}

function SettingsOutputsEditor({ data, nodeDef, onChange }: SettingsOutputsEditorProps) {
  const [open, setOpen] = useState(true)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draftOutput, setDraftOutput] = useState<CustomOutputDef | null>(null)
  const [draftError, setDraftError] = useState<string | null>(null)
  const baseOutputs = getBaseOutputs(nodeDef)
  const customOutputs = getCustomOutputs(data)

  const commitCustomOutputs = useCallback(
    (outputs: CustomOutputDef[]) => {
      onChange({ ...data, customOutputs: outputs })
    },
    [data, onChange],
  )

  const handleAddOutput = useCallback(() => {
    setEditingIndex(customOutputs.length)
    setDraftOutput(createEmptyOutput())
    setDraftError(null)
  }, [customOutputs.length])

  const handleEditOutput = useCallback((index: number, output: CustomOutputDef) => {
    setEditingIndex(index)
    setDraftOutput(output)
    setDraftError(null)
  }, [])

  const handleUpdateDraft = useCallback((patch: Partial<CustomOutputDef>) => {
    setDraftOutput((current) => (current ? { ...current, ...patch } : current))
    setDraftError(null)
  }, [])

  const handleConfirmDraft = useCallback(() => {
    if (editingIndex === null || !draftOutput) return

    const name = normalizeOutputName(draftOutput.name)
    if (!name) {
      setDraftError('变量名不能为空')
      return
    }

    const baseNameSet = new Set(baseOutputs.map((output) => normalizeOutputName(output.name)))
    if (baseNameSet.has(name)) {
      setDraftError('变量名不能和默认输出重复')
      return
    }

    const isDuplicate = customOutputs.some(
      (output, index) => index !== editingIndex && normalizeOutputName(output.name) === name,
    )
    if (isDuplicate) {
      setDraftError('变量名不能重复')
      return
    }

    const nextOutput: CustomOutputDef = {
      ...draftOutput,
      name,
      description: draftOutput.description?.trim(),
      expression: draftOutput.expression.trim(),
    }

    const nextOutputs =
      editingIndex >= customOutputs.length
        ? [...customOutputs, nextOutput]
        : customOutputs.map((output, index) => (index === editingIndex ? nextOutput : output))

    commitCustomOutputs(nextOutputs)
    setEditingIndex(null)
    setDraftOutput(null)
    setDraftError(null)
  }, [baseOutputs, commitCustomOutputs, customOutputs, draftOutput, editingIndex])

  const handleDeleteOutput = useCallback(
    (index: number) => {
      if (index >= customOutputs.length) {
        setEditingIndex(null)
        setDraftOutput(null)
        setDraftError(null)
        return
      }

      commitCustomOutputs(customOutputs.filter((_, i) => i !== index))
      setEditingIndex((current) => {
        if (current === null) return null
        if (current === index) return null
        return current > index ? current - 1 : current
      })
      setDraftOutput(null)
      setDraftError(null)
    },
    [commitCustomOutputs, customOutputs],
  )

  const outputRows =
    editingIndex !== null && editingIndex >= customOutputs.length
      ? [...customOutputs, draftOutput ?? createEmptyOutput()]
      : customOutputs
  const hasOutputRows = outputRows.length > 0

  return (
    <section className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-medium text-muted-foreground">输出变量</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            !open && '-rotate-90',
          )}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {baseOutputs.length === 0 ? (
              <p className="text-xs text-muted-foreground">当前节点没有固定输出</p>
            ) : (
              baseOutputs.map((output) => (
                <div key={output.name} className="flex flex-col gap-0.5">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate font-mono text-sm font-semibold text-foreground">
                      {output.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">
                      {output.type}
                    </span>
                  </div>
                  {output.description && (
                    <p className="text-xs text-muted-foreground">{output.description}</p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2.5 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">额外输出</p>
              <Button variant="outline" size="xs" onClick={handleAddOutput}>
                <Plus className="h-3 w-3" />
                添加字段
              </Button>
            </div>

            {!hasOutputRows ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                暂无额外输出字段
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {outputRows.map((output, idx) => (
                  <div key={idx}>
                    {editingIndex === idx ? (
                      <div className="rounded-md border border-border bg-card/60 p-2 shadow-sm">
                        <div className="grid grid-cols-[minmax(0,1fr)_92px_24px_24px] items-center gap-2">
                          <Input
                            size="xs"
                            value={draftOutput?.name ?? ''}
                            placeholder="字段名"
                            className={cn('font-mono', draftError && 'border-destructive')}
                            onChange={(e) => handleUpdateDraft({ name: e.target.value })}
                          />
                          <Select
                            value={draftOutput?.type ?? 'string'}
                            onValueChange={(value) =>
                              handleUpdateDraft({ type: value as CustomOutputDef['type'] })
                            }
                          >
                            <SelectTrigger size="xs" className="min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {OUTPUT_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={handleConfirmDraft}
                            className="px-0 text-muted-foreground hover:text-foreground"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDeleteOutput(idx)}
                            className="px-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Input
                          size="xs"
                          value={draftOutput?.description ?? ''}
                          placeholder="添加描述"
                          className="mt-2"
                          onChange={(e) => handleUpdateDraft({ description: e.target.value })}
                        />
                        <Input
                          size="xs"
                          value={draftOutput?.expression ?? ''}
                          placeholder="取值表达式，例如 names[0]"
                          className="mt-2 font-mono"
                          onChange={(e) => handleUpdateDraft({ expression: e.target.value })}
                        />
                        {draftError && (
                          <p className="mt-1 text-[11px] text-destructive">{draftError}</p>
                        )}
                      </div>
                    ) : (
                      <div className="group flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="truncate font-mono text-sm font-semibold text-foreground">
                              {output.name || '未命名字段'}
                            </span>
                            <span className="shrink-0 font-mono text-xs font-medium text-muted-foreground">
                              {output.type}
                            </span>
                          </div>
                          {output.description ? (
                            <p className="text-xs text-muted-foreground">{output.description}</p>
                          ) : null}
                          {output.expression ? (
                            <p className="truncate font-mono text-[11px] text-muted-foreground/80">
                              {output.expression}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleEditOutput(idx, output)}
                            className="px-1 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => handleDeleteOutput(idx)}
                            className="px-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export { SettingsOutputsEditor }
export type { SettingsOutputsEditorProps }
