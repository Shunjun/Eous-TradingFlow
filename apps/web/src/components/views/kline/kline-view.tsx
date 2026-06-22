import { KlineChart } from '@eous/chart'
import { useKlineData } from './use-kline-data.js'
import type { KlineViewProps } from './use-kline-view-state.js'

export function KlineView(props: KlineViewProps) {
  const {
    fetchKlines,
    getSymbols,
    getIntervals,
    getProviders,
    subscribeKlineUpdates,
    getDrawings,
    saveDrawings,
    getChartConfig,
    saveChartConfig,
  } = useKlineData()

  return (
    <div className="h-full">
      <KlineChart
        fetchKlines={fetchKlines}
        getSymbols={getSymbols}
        getIntervals={getIntervals}
        getProviders={getProviders}
        subscribeKlineUpdates={subscribeKlineUpdates}
        getDrawings={getDrawings}
        saveDrawings={saveDrawings}
        getChartConfig={getChartConfig}
        saveChartConfig={saveChartConfig}
        {...props}
      />
    </div>
  )
}
