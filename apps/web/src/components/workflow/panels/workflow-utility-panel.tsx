import type { ReactNode } from 'react'
import { Camera, Clock3, Variable, X } from 'lucide-react'
import type { WorkflowEditEvent } from '@eous/api-client'
import { Badge, Button, ScrollArea, SheetContent } from '@eous/ui'
import { VariableInspector } from '../variables'
import { stackedPanelClassName } from './stacked-side-panels'

interface WorkflowUtilityPanelProps {
  workflowId: string
  panel: 'variables' | 'snapshots'
  snapshots: WorkflowEditEvent[]
  onClose: () => void
  onCreateSnapshot: () => void
  onRestoreSnapshot: (eventId: string) => void
}

function PanelHeader({
  icon,
  title,
  onClose,
  action,
}: {
  icon: ReactNode
  title: string
  onClose: () => void
  action?: ReactNode
}) {
  return (
    <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {icon}
        <span className="truncate text-sm font-medium text-foreground">{title}</span>
      </div>
      {action}
      <button
        type="button"
        onClick={onClose}
        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function WorkflowUtilityPanel({
  workflowId,
  panel,
  snapshots,
  onClose,
  onCreateSnapshot,
  onRestoreSnapshot,
}: WorkflowUtilityPanelProps) {
  return (
    <SheetContent
      inline
      side="right"
      showCloseButton={false}
      showOverlay={false}
      className={stackedPanelClassName('w-[340px]')}
    >
      {panel === 'variables' ? (
        <>
          <PanelHeader
            icon={<Variable className="h-4 w-4 text-primary" />}
            title="变量"
            onClose={onClose}
          />
          <div className="min-h-0 flex-1 overflow-hidden">
            <VariableInspector workflowId={workflowId} />
          </div>
        </>
      ) : (
        <>
          <PanelHeader
            icon={<Clock3 className="h-4 w-4 text-primary" />}
            title="快照"
            onClose={onClose}
            action={
              <Button size="xs" variant="outline" onClick={onCreateSnapshot}>
                <Camera className="mr-1 h-3.5 w-3.5" />
                保存
              </Button>
            }
          />
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-2 p-3">
              {snapshots.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">
                  暂无快照
                </div>
              ) : (
                snapshots.map((snapshot) => (
                  <button
                    key={snapshot.id}
                    type="button"
                    onClick={() => onRestoreSnapshot(snapshot.id)}
                    className="flex w-full flex-col gap-1 rounded-md border border-border bg-muted/25 px-3 py-2 text-left transition-colors hover:bg-muted/45"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {snapshot.snapshotName ?? snapshot.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        seq {snapshot.seq}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(snapshot.createdAt).toLocaleString()}
                    </span>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </SheetContent>
  )
}

export { WorkflowUtilityPanel }
export type { WorkflowUtilityPanelProps }
