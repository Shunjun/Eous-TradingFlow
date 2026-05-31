import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { Bot } from 'lucide-react'

export default function ProvidersPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={Bot} title="Providers" />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">
            coming soon
          </p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
