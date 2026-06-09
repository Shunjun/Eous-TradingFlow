import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import {
  Button,
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  Skeleton,
} from '@eous/ui'
import { useWorkflowList } from '../../../hooks/use-workflows'
import { CreateWorkflowDialog } from '../../../components/workflow/create-workflow-dialog'
import { WorkflowCard } from '../../../components/workflow/workflow-card'

export default function WorkflowsPage() {
  const { workflows, loading } = useWorkflowList()
  const navigate = useNavigate()
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleCreated = useCallback(
    (id: string) => {
      setDialogOpen(false)
      navigate(`/workflow/${id}`)
    },
    [navigate],
  )

  if (loading) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <CardPanel>
          <CardPanelHeader icon={GitBranch} title="工作流" />
          <CardPanelBody className="p-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          </CardPanelBody>
        </CardPanel>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader
          icon={GitBranch}
          title="工作流"
          action={{ label: '新建', onClick: () => setDialogOpen(true) }}
        />
        <CardPanelBody className="p-6">
          {workflows.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GitBranch />
                </EmptyMedia>
                <EmptyTitle>还没有工作流</EmptyTitle>
                <EmptyDescription>创建你的第一个交易分析工作流</EmptyDescription>
              </EmptyHeader>
              <Button onClick={() => setDialogOpen(true)}>新建工作流</Button>
            </Empty>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workflows.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  name={wf.name}
                  nodeCount={wf.nodes.length}
                  updatedAt={wf.updatedAt}
                  onClick={() => navigate(`/workflow/${wf.id}`)}
                />
              ))}
            </div>
          )}
        </CardPanelBody>
      </CardPanel>
      <CreateWorkflowDialog
        open={dialogOpen}
        onCreated={handleCreated}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  )
}
