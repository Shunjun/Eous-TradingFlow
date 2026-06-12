import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core'
import type {
  ILineToolsPlugin,
  LineToolsAfterEditEventParams,
  LineToolType,
} from 'lightweight-charts-line-tools-core'
import { registerAllLineTools } from '../line-tools/registry'

export type SelectionChangeHandler = (hasSelection: boolean) => void
export type ActiveToolChangeHandler = (activeTool: LineToolType | 'none') => void

export class LineToolsEngine {
  private plugin: ILineToolsPlugin
  private chart: IChartApi
  private _activeTool: LineToolType | 'none' = 'none'
  private selectionListeners = new Set<SelectionChangeHandler>()
  private activeToolListeners = new Set<ActiveToolChangeHandler>()
  private selectionHandler: (() => void) | null = null
  private afterEditHandler: ((params: LineToolsAfterEditEventParams) => void) | null = null

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) {
    this.chart = chart
    this.plugin = createLineToolsPlugin(chart, candleSeries)
    registerAllLineTools(this.plugin)

    this.selectionHandler = () => this.emitSelectionChange()
    this.plugin.subscribeLineToolsSingleClick(this.selectionHandler)
    this.afterEditHandler = (params) => {
      if (params.stage !== 'lineToolFinished') return
      this.setActiveToolState('none')
      this.setChartNavigationEnabled(true)
    }
    this.plugin.subscribeLineToolsAfterEdit(this.afterEditHandler)
  }

  get activeTool(): LineToolType | 'none' {
    return this._activeTool
  }

  setActiveTool(type: LineToolType | 'none'): void {
    if (type === 'none') {
      this.setActiveToolState('none')
      this.setChartNavigationEnabled(true)
    } else {
      this.setActiveToolState(type)
      this.setChartNavigationEnabled(false)
      this.plugin.addLineTool(type)
    }
  }

  toggleTool(type: LineToolType): void {
    if (this._activeTool === type) {
      this.setActiveTool('none')
    } else {
      this.setActiveTool(type)
    }
  }

  deleteSelected(): void {
    this.plugin.removeSelectedLineTools()
  }

  exportTools(): string | null {
    return this.plugin.exportLineTools()
  }

  importTools(json: string): boolean {
    return this.plugin.importLineTools(json)
  }

  onSelectionChange(handler: SelectionChangeHandler): () => void {
    this.selectionListeners.add(handler)
    return () => {
      this.selectionListeners.delete(handler)
    }
  }

  onActiveToolChange(handler: ActiveToolChangeHandler): () => void {
    this.activeToolListeners.add(handler)
    return () => {
      this.activeToolListeners.delete(handler)
    }
  }

  hasSelectedDrawing(): boolean {
    const selected = this.plugin.getSelectedLineTools()
    return selected !== '[]' && selected.length > 2
  }

  private emitSelectionChange(): void {
    const hasSelection = this.hasSelectedDrawing()
    for (const handler of this.selectionListeners) {
      handler(hasSelection)
    }
  }

  private setActiveToolState(activeTool: LineToolType | 'none'): void {
    if (this._activeTool === activeTool) return
    this._activeTool = activeTool
    for (const handler of this.activeToolListeners) {
      handler(activeTool)
    }
  }

  private setChartNavigationEnabled(enabled: boolean): void {
    this.chart.applyOptions({
      handleScroll: enabled,
      handleScale: enabled,
    })
  }

  destroy(): void {
    this.setChartNavigationEnabled(true)
    if (this.selectionHandler) {
      this.plugin.unsubscribeLineToolsSingleClick(this.selectionHandler)
      this.selectionHandler = null
    }
    if (this.afterEditHandler) {
      this.plugin.unsubscribeLineToolsAfterEdit(this.afterEditHandler)
      this.afterEditHandler = null
    }
    this.selectionListeners.clear()
    this.activeToolListeners.clear()
    this.plugin.destroy()
  }
}
