import { useState, useCallback, useEffect } from 'react'
import { X, Trash2, Plus, Play, Loader2, Variable } from 'lucide-react'
import {
  Button,
  Input,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  cn,
} from '@eous/ui'
import { getNodeDef, type OutputDef, type NodeDef } from '@eous/nodes'
import { useWorkflowStore } from '../../stores/workflow'
import { api } from '../../lib/api'
import { ConfigForm } from './config-form'
import { VariableInspector } from './variable-inspector'

const OUTPUT_TYPES = ['string', 'number', 'boolean', 'json', 'array', 'file'] as const

/** Get effective outputs — lazy init: fallback to def.executeOutput when data.outputs is not set */
function getEffectiveOutputs(data: Record<string, unknown>, def: NodeDef | undefined): OutputDef[] {
  if (Array.isArray(data.outputs)) return data.outputs as OutputDef[]
  if (!def) return []
  return Object.values(def.executeOutput).map((f) => ({
    name: f.name,
    type: f.type as OutputDef['type'],
    source: f.source,
  }))
}

/** Lazily initialize data.outputs from def fallback, preserving any current edits */
function ensureOutputsInData(
  data: Record<string, unknown>,
  def: NodeDef | undefined,
  onChange: (data: Record<string, unknown>) => void,
): OutputDef[] {
  if (Array.isArray(data.outputs)) return data.outputs as OutputDef[]
  const fallback = getEffectiveOutputs(data, def)
  onChange({ ...data, outputs: fallback })
  return fallback
}

interface NodeExecution {
  id: string
  nodeId: string
  status: string
  inputs: Record<string, unknown> | null
  outputs: Record<string, unknown> | null
  logs: Array<{ ts: string; level: string; message: string }>
  durationMs: number | null
  error: string | null
}

function SettingsPanelContent({
  workflowId,
  nodeId,
  nodeType,
  data,
  onChange,
  onClose,
  inspectorOpen,
  onToggleInspector,
}: {
  workflowId: string
  nodeId: string
  nodeType: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  onClose: () => void
  inspectorOpen: boolean
  onToggleInspector: () => void
}) {
  const [running, setRunning] = useState(false)
  const [lastExecution, setLastExecution] = useState<NodeExecution | null>(null)
  const [loadingExecution, setLoadingExecution] = useState(true)
  const [upstreamOutputs, setUpstreamOutputs] = useState<Record<string, Record<string, unknown>>>(
    {},
  )

  const nodeDef = getNodeDef(nodeType)
  const executeInput = nodeDef?.executeInput

  // Fetch upstream outputs on mount and after run
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await api.getWorkflowVariables(workflowId)
        if (!cancelled) setUpstreamOutputs(res.variables)
      } catch {
        if (!cancelled) setUpstreamOutputs({})
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workflowId])

  // Fetch last execution
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingExecution(true)
      try {
        const res = await api.getNodeLastExecution(workflowId, nodeId)
        if (!cancelled) setLastExecution(res.execution)
      } catch {
        if (!cancelled) setLastExecution(null)
      } finally {
        if (!cancelled) setLoadingExecution(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workflowId, nodeId])

  const handleRun = useCallback(async () => {
    setRunning(true)
    try {
      const res = await api.runWorkflowNode(workflowId, nodeId)
      setLastExecution(res.execution)
      // Refresh upstream outputs after run
      const varRes = await api.getWorkflowVariables(workflowId)
      setUpstreamOutputs(varRes.variables)
    } catch {
      // error handled by global error handler
    } finally {
      setRunning(false)
    }
  }, [workflowId, nodeId])

  const handleOutputFieldChange = useCallback(
    (index: number, field: keyof OutputDef, value: string) => {
      const outputs = ensureOutputsInData(data, nodeDef, onChange)
      const updated = [...outputs]
      if (field === 'name') {
        updated[index] = { ...updated[index], name: value }
      } else if (field === 'type') {
        updated[index] = { ...updated[index], type: value as OutputDef['type'] }
      } else if (field === 'source') {
        // handled separately via handleOutputSourceChange
      }
      onChange({ ...data, outputs: updated })
    },
    [data, nodeDef, onChange],
  )

  const handleOutputSourceChange = useCallback(
    (index: number, subField: 'field' | 'path', value: string) => {
      const outputs = ensureOutputsInData(data, nodeDef, onChange)
      const updated = [...outputs]
      updated[index] = {
        ...updated[index],
        source: { ...updated[index].source, [subField]: value || undefined },
      }
      onChange({ ...data, outputs: updated })
    },
    [data, nodeDef, onChange],
  )

  const handleOutputDelete = useCallback(
    (index: number) => {
      const outputs = ensureOutputsInData(data, nodeDef, onChange)
      onChange({ ...data, outputs: outputs.filter((_, i) => i !== index) })
    },
    [data, nodeDef, onChange],
  )

  const handleAddOutput = useCallback(() => {
    const outputs = ensureOutputsInData(data, nodeDef, onChange)
    onChange({
      ...data,
      outputs: [...outputs, { name: '', type: 'string', source: { field: '' } }],
    })
  }, [data, nodeDef, onChange])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {typeof data.label === 'string' ? data.label : nodeType}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-7 px-2 text-xs', inspectorOpen && 'bg-accent text-accent-foreground')}
            onClick={onToggleInspector}
          >
            <Variable className="mr-1 h-3 w-3" />
            变量
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRun}
            disabled={running}
          >
            {running ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1 h-3 w-3" />
            )}
            Run
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Tabs defaultValue="config" className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="h-9">
            <TabsTrigger value="config" className="text-xs">
              设置
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              上次运行
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-5 p-4">
              {executeInput && Object.keys(executeInput).length > 0 && (
                <ConfigForm
                  nodeDef={nodeDef!}
                  nodeId={nodeId}
                  data={data}
                  onChange={onChange}
                  upstreamOutputs={upstreamOutputs}
                />
              )}

              <Separator />

              <div className="flex flex-col gap-3">
                <p className="text-xs font-medium text-muted-foreground">输出</p>
                {getEffectiveOutputs(data, nodeDef).map((output, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <Input
                      value={output.name}
                      placeholder="name"
                      className="h-6 w-[72px] flex-shrink-0 font-mono text-[11px]"
                      onBlur={(e) => {
                        if (e.target.value !== output.name) {
                          handleOutputFieldChange(idx, 'name', e.target.value.trim())
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.currentTarget.blur()
                        }
                      }}
                    />
                    <Select
                      value={output.type}
                      onValueChange={(v) => handleOutputFieldChange(idx, 'type', v)}
                    >
                      <SelectTrigger className="h-6 w-[80px] flex-shrink-0 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OUTPUT_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-[11px]">
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground">field:</span>
                    <Input
                      value={output.source.field}
                      placeholder="field"
                      className="h-6 w-[64px] flex-shrink-0 font-mono text-[11px]"
                      onBlur={(e) => {
                        if (e.target.value !== output.source.field) {
                          handleOutputSourceChange(idx, 'field', e.target.value.trim())
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                    />
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground">path:</span>
                    <Input
                      value={output.source.path ?? ''}
                      placeholder="—"
                      className="h-6 w-[56px] flex-shrink-0 font-mono text-[11px]"
                      onBlur={(e) => {
                        const v = e.target.value.trim()
                        if (v !== (output.source.path ?? '')) {
                          handleOutputSourceChange(idx, 'path', v)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur()
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleOutputDelete(idx)}
                      className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-fit text-xs"
                  onClick={handleAddOutput}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  添加输出字段
                </Button>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loadingExecution ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : !lastExecution ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-muted-foreground">暂无运行记录</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 p-4">
                {/* Status & Duration */}
                <div className="flex items-center gap-2">
                  <Badge variant={lastExecution.status === 'succeeded' ? 'default' : 'destructive'}>
                    {lastExecution.status === 'succeeded'
                      ? '成功'
                      : lastExecution.status === 'failed'
                        ? '失败'
                        : lastExecution.status}
                  </Badge>
                  {lastExecution.durationMs != null && (
                    <span className="text-[10px] text-muted-foreground">
                      {lastExecution.durationMs}ms
                    </span>
                  )}
                  {lastExecution.error && (
                    <span className="text-[10px] text-destructive">{lastExecution.error}</span>
                  )}
                </div>

                {/* Inputs */}
                {lastExecution.inputs && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">输入</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] text-foreground">
                      {JSON.stringify(lastExecution.inputs, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Outputs */}
                {lastExecution.outputs && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">输出</p>
                    <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-[10px] text-foreground">
                      {JSON.stringify(lastExecution.outputs, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Logs */}
                {lastExecution.logs.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-medium text-muted-foreground">日志</p>
                    <div className="flex flex-col gap-0.5">
                      {lastExecution.logs.map((log, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px]">
                          <Badge
                            variant={
                              log.level === 'error'
                                ? 'destructive'
                                : log.level === 'warn'
                                  ? 'outline'
                                  : 'secondary'
                            }
                            className="shrink-0 text-[9px]"
                          >
                            {log.level}
                          </Badge>
                          <span className="text-foreground">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface SettingsPanelProps {
  workflowId: string
  nodeId: string | null
  nodeType: string | null
  data: Record<string, unknown> | null
  logOpen: boolean
  logHeight: number
  onChange: (data: Record<string, unknown>) => void
  onClose: () => void
}

function SettingsPanel({
  workflowId,
  nodeId,
  nodeType,
  data,
  logOpen,
  logHeight,
  onChange,
  onClose,
}: SettingsPanelProps) {
  const isVisible = nodeId !== null && nodeType !== null && data !== null
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const handleToggleInspector = useCallback(() => {
    setInspectorOpen((prev) => !prev)
  }, [])

  // Close inspector when panel closes
  useEffect(() => {
    if (!isVisible) setInspectorOpen(false)
  }, [isVisible])

  return (
    <>
      {/* Settings sheet — non-modal, only closes when clicking another node */}
      <Sheet modal={false} open={isVisible} onOpenChange={() => {}}>
        <SheetContent
          side="right"
          showCloseButton={false}
          showOverlay={false}
          className={cn(
            'top-16 h-auto w-[380px] max-w-[380px] rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur',
            'transition-[right,bottom] duration-300 ease-out',
            inspectorOpen ? '!right-[412px]' : '!right-3',
          )}
          style={{ bottom: logOpen ? logHeight + 52 : 52 }}
        >
          {isVisible && (
            <SettingsPanelContent
              workflowId={workflowId}
              nodeId={nodeId}
              nodeType={nodeType}
              data={data}
              onChange={onChange}
              onClose={onClose}
              inspectorOpen={inspectorOpen}
              onToggleInspector={handleToggleInspector}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Variable inspector sheet */}
      <Sheet
        open={isVisible && inspectorOpen}
        onOpenChange={(open) => {
          if (!open) setInspectorOpen(false)
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className={cn(
            'top-16 h-auto w-[400px] max-w-[400px] rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur !right-3',
            'transition-[bottom] duration-300 ease-out',
          )}
          style={{ bottom: logOpen ? logHeight + 52 : 52 }}
        >
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm">变量查看器</SheetTitle>
            <button
              type="button"
              onClick={handleToggleInspector}
              className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <VariableInspector workflowId={workflowId} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

SettingsPanel.displayName = 'SettingsPanel'

export { SettingsPanel }
export type { SettingsPanelProps }
