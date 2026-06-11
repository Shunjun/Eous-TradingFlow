import { KlineChart } from '@eous/chart'
import { useKlineData } from './use-kline-data.js'
import type { KlineViewProps } from './use-kline-view-state.js'

export function KlineView(props: KlineViewProps) {
  const { fetchKlines, getSymbols, getIntervals, getProviders } = useKlineData()

  return (
    <div className="h-full">
      <KlineChart
        fetchKlines={fetchKlines}
        getSymbols={getSymbols}
        getIntervals={getIntervals}
        getProviders={getProviders}
        {...props}
      />
    </div>
  )
}
