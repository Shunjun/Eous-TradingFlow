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
  cn,
} from '@eous/ui'
import { getNodeDef, type OutputDef } from '@eous/nodes'
import { ConfigForm } from './config-form'
import { VariableInspector } from '../variables'
import { ensureOutputsInData, getEffectiveOutputs, OUTPUT_TYPES } from './settings-panel-outputs'
import { useNodeExecution } from '../hooks'
import { useWorkflowStore } from '../store/workflow-store'

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
  const nodeDef = getNodeDef(nodeType)
  const executeInput = nodeDef?.executeInput
  const { running, lastExecution, loadingExecution, upstreamOutputs, runNode } = useNodeExecution(
    workflowId,
    nodeId,
  )

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
            onClick={runNode}
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
}

function SettingsPanel({ workflowId }: SettingsPanelProps) {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const selectedNode = useWorkflowStore((state) =>
    state.selectedNodeId
      ? (state.nodes.find((node) => node.id === state.selectedNodeId) ?? null)
      : null,
  )
  const commitOps = useWorkflowStore((state) => state.commitOps)
  const onClose = useWorkflowStore((state) => state.closeSettingsPanel)
  const nodeId = selectedNodeId
  const nodeType = selectedNode?.type ?? null
  const data = selectedNode?.data ?? null
  const isVisible = nodeId !== null && nodeType !== null && data !== null
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const handleChange = useCallback(
    (nextData: Record<string, unknown>) => {
      if (!selectedNodeId) return
      commitOps(
        [{ type: 'node.update', nodeId: selectedNodeId, dataPatch: nextData }],
        '修改节点配置',
      )
    },
    [commitOps, selectedNodeId],
  )

  const handleToggleInspector = useCallback(() => {
    setInspectorOpen((prev) => !prev)
  }, [])

  // Close inspector when panel closes
  useEffect(() => {
    if (!isVisible) setInspectorOpen(false)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <Sheet modal={false} open={isVisible} onOpenChange={() => {}}>
      <div className="pointer-events-auto flex h-full min-h-0 items-stretch gap-3">
        {inspectorOpen && (
          <SheetContent
            inline
            side="right"
            showCloseButton={false}
            showOverlay={false}
            className={cn(
              'h-full w-[400px] min-h-0 overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur',
              'animate-[workflow-panel-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]',
            )}
          >
            <div className="relative flex h-12 items-center border-b border-border px-4">
              <span className="text-sm font-medium text-foreground">变量查看器</span>
              <button
                type="button"
                onClick={handleToggleInspector}
                className="absolute right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <VariableInspector workflowId={workflowId} />
            </div>
          </SheetContent>
        )}

        <SheetContent
          inline
          side="right"
          showCloseButton={false}
          showOverlay={false}
          className={cn(
            'h-full w-[380px] min-h-0 overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur',
            'animate-[workflow-panel-in_180ms_cubic-bezier(0.16,1,0.3,1)_both]',
          )}
        >
          <SettingsPanelContent
            workflowId={workflowId}
            nodeId={nodeId}
            nodeType={nodeType}
            data={data}
            onChange={handleChange}
            onClose={onClose}
            inspectorOpen={inspectorOpen}
            onToggleInspector={handleToggleInspector}
          />
        </SheetContent>
      </div>
    </Sheet>
  )
}

SettingsPanel.displayName = 'SettingsPanel'

export { SettingsPanel }
export type { SettingsPanelProps }
