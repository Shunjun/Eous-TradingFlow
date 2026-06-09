import { useParams } from 'react-router-dom'
import { ReactFlowProvider } from '@xyflow/react'
import { WorkflowEditor } from '../../../../components/workflow/workflow-editor'

export default function WorkflowEditorPage() {
  const { id } = useParams()

  if (!id) return null

  return (
    <ReactFlowProvider>
      <WorkflowEditor workflowId={id} />
    </ReactFlowProvider>
  )
}
