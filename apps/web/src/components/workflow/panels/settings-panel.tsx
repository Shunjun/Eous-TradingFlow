import { useCallback, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import {
  ScrollArea,
  Sheet,
  SheetContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
} from '@eous/ui'
import { getNodeDef } from '@eous/nodes'
import { VariableInspector } from '../variables'
import { useNodeExecution } from '../hooks'
import { useWorkflowStore } from '../store/workflow-store'
import { SettingsConfigTab } from './settings-config-tab'
import { SettingsExecutionHistory } from './settings-execution-history'
import { SettingsPanelHeader } from './settings-panel-header'

function panelClassName(width: string) {
  return cn(
    'h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur',
    width,
  )
}

interface SettingsPanelContentProps {
  workflowId: string
  nodeId: string
  nodeType: string
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
  onClose: () => void
  inspectorOpen: boolean
  onToggleInspector: () => void
  onBeforeRun?: () => Promise<unknown>
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
  onBeforeRun,
}: SettingsPanelContentProps) {
  const nodeDef = getNodeDef(nodeType)
  const { running, lastExecution, loadingExecution, upstreamOutputs, runNode } = useNodeExecution(
    workflowId,
    nodeId,
    onBeforeRun,
  )
  const title = typeof data.label === 'string' ? data.label : (nodeDef?.meta.label ?? nodeType)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SettingsPanelHeader
        title={title}
        inspectorOpen={inspectorOpen}
        running={running}
        onToggleInspector={onToggleInspector}
        onRun={runNode}
        onClose={onClose}
      />

      <Tabs defaultValue="config" className="min-h-0 flex-1 gap-0 overflow-hidden">
        <div className="shrink-0 border-b border-border bg-card/60 px-3">
          <TabsList variant="line" className="h-9">
            <TabsTrigger value="config" className="text-xs">
              设置
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              上次运行
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config" className="min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <SettingsConfigTab
              nodeDef={nodeDef}
              nodeId={nodeId}
              data={data}
              upstreamOutputs={upstreamOutputs}
              onChange={onChange}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="history" className="min-h-0 overflow-hidden">
          <ScrollArea className="h-full">
            <SettingsExecutionHistory loading={loadingExecution} execution={lastExecution} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SettingsInspectorPanel({
  workflowId,
  onClose,
}: {
  workflowId: string
  onClose: () => void
}) {
  return (
    <SheetContent
      inline
      side="right"
      showCloseButton={false}
      showOverlay={false}
      className={panelClassName('w-[400px]')}
    >
      <div className="relative flex h-12 shrink-0 items-center border-b border-border bg-card/80 px-3">
        <span className="text-sm font-medium text-foreground">变量查看器</span>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <VariableInspector workflowId={workflowId} />
      </div>
    </SheetContent>
  )
}

interface SettingsPanelProps {
  workflowId: string
  onBeforeRun?: () => Promise<unknown>
}

function SettingsPanel({ workflowId, onBeforeRun }: SettingsPanelProps) {
  const selectedNodeId = useWorkflowStore((state) => state.selectedNodeId)
  const nodeType = useWorkflowStore((state) =>
    state.selectedNodeId
      ? (state.nodes.find((node) => node.id === state.selectedNodeId)?.type ?? null)
      : null,
  )
  const data = useWorkflowStore((state) =>
    state.selectedNodeId
      ? (state.nodes.find((node) => node.id === state.selectedNodeId)?.data ?? null)
      : null,
  )
  const commitOps = useWorkflowStore((state) => state.commitOps)
  const onClose = useWorkflowStore((state) => state.closeSettingsPanel)
  const nodeId = selectedNodeId
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

  useEffect(() => {
    if (!isVisible) setInspectorOpen(false)
  }, [isVisible])

  if (!isVisible) return null

  return (
    <Sheet modal={false} open={isVisible} onOpenChange={() => {}}>
      <div className="pointer-events-auto flex h-full min-h-0 items-stretch gap-3">
        {inspectorOpen && (
          <SettingsInspectorPanel workflowId={workflowId} onClose={handleToggleInspector} />
        )}

        <SheetContent
          inline
          side="right"
          showCloseButton={false}
          showOverlay={false}
          className={panelClassName('w-[380px]')}
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
            onBeforeRun={onBeforeRun}
          />
        </SheetContent>
      </div>
    </Sheet>
  )
}

SettingsPanel.displayName = 'SettingsPanel'

export { SettingsPanel }
export type { SettingsPanelProps }
