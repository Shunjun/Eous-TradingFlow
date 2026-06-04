import { useParams } from 'react-router-dom'
import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { GitBranch } from 'lucide-react'

export default function WorkflowEditorPage() {
  const { id } = useParams()

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={GitBranch} title={`Workflow Editor — ${id}`} />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">Workflow editor coming soon…</p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
