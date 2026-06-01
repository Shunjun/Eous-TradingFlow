import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { Sliders } from 'lucide-react'

export default function GeneralSettingsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Sliders} title="General Settings" />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">
            General settings coming soon…
          </p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
