import { useRef, useEffect } from 'react'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core'
import type { ILineToolsPlugin, LineToolType } from 'lightweight-charts-line-tools-core'
import { registerLinesPlugin } from 'lightweight-charts-line-tools-lines'
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle'

export function useLineTools(
  chart: IChartApi | null,
  candleSeries: ISeriesApi<'Candlestick'> | null,
) {
  const pluginRef = useRef<ILineToolsPlugin | null>(null)

  useEffect(() => {
    if (!chart || !candleSeries || pluginRef.current) return

    const plugin = createLineToolsPlugin(chart, candleSeries)

    // Register tools from lines package
    registerLinesPlugin(plugin as any)

    // Register rectangle manually
    plugin.registerLineTool('Rectangle' as LineToolType, LineToolRectangle as any)

    pluginRef.current = plugin

    return () => {
      pluginRef.current = null
    }
  }, [chart, candleSeries])

  function addLineTool(type: LineToolType) {
    const plugin = pluginRef.current
    if (!plugin) return
    plugin.addLineTool(type)
  }

  function deleteSelected() {
    const plugin = pluginRef.current
    if (!plugin) return
    plugin.removeSelectedLineTools()
  }

  function exportTools(): string | null {
    const plugin = pluginRef.current
    if (!plugin) return null
    return plugin.exportLineTools()
  }

  function importTools(json: string): boolean {
    const plugin = pluginRef.current
    if (!plugin) return false
    return plugin.importLineTools(json)
  }

  return {
    addLineTool,
    deleteSelected,
    exportTools,
    importTools,
    plugin: pluginRef,
  }
}
