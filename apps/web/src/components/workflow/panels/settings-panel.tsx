import { useCallback } from 'react'
import { ScrollArea, SheetContent, Tabs, TabsContent, TabsList, TabsTrigger, cn } from '@eous/ui'
import { getNodeDef } from '@eous/nodes'
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
  onBeforeRun?: () => Promise<unknown>
}

function SettingsPanelContent({
  workflowId,
  nodeId,
  nodeType,
  data,
  onChange,
  onClose,
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
      <SettingsPanelHeader title={title} running={running} onRun={runNode} onClose={onClose} />

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

  if (!isVisible) return null

  return (
    <SheetContent
      inline
      side="right"
      showCloseButton={false}
      showOverlay={false}
      className={panelClassName('w-[360px]')}
    >
      <SettingsPanelContent
        workflowId={workflowId}
        nodeId={nodeId}
        nodeType={nodeType}
        data={data}
        onChange={handleChange}
        onClose={onClose}
        onBeforeRun={onBeforeRun}
      />
    </SheetContent>
  )
}

SettingsPanel.displayName = 'SettingsPanel'

export { SettingsPanel }
export type { SettingsPanelProps }
