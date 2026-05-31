import { CardPanel, CardPanelHeader, CardPanelBody } from '@eous/ui'
import { BarChart3 } from 'lucide-react'

export default function WatchlistPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <CardPanel>
        <CardPanelHeader icon={BarChart3} title="Watchlist" />
        <CardPanelBody className="p-6">
          <p className="text-sm text-muted-foreground font-mono">
            coming soon
          </p>
        </CardPanelBody>
      </CardPanel>
    </div>
  )
}
