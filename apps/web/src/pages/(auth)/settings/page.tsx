import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Settings} title="Settings" />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">
            Settings panel coming soon…
          </p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
