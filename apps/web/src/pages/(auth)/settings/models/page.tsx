import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { Cpu } from 'lucide-react'

export default function ModelSettingsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Cpu} title="Model Settings" />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">
            Model configuration coming soon…
          </p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
