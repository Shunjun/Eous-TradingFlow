import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core'
import type { ILineToolsPlugin, LineToolType } from 'lightweight-charts-line-tools-core'
import { registerAllLineTools } from '../line-tools/registry'

export type SelectionChangeHandler = (hasSelection: boolean) => void

export class LineToolsEngine {
  private plugin: ILineToolsPlugin
  private _activeTool: LineToolType | 'none' = 'none'
  private selectionListeners = new Set<SelectionChangeHandler>()
  private selectionHandler: (() => void) | null = null

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) {
    this.plugin = createLineToolsPlugin(chart, candleSeries)
    registerAllLineTools(this.plugin)

    this.selectionHandler = () => this.emitSelectionChange()
    this.plugin.subscribeLineToolsSingleClick(this.selectionHandler)
  }

  get activeTool(): LineToolType | 'none' {
    return this._activeTool
  }

  setActiveTool(type: LineToolType | 'none'): void {
    if (type === 'none') {
      this._activeTool = 'none'
    } else {
      this._activeTool = type
      this.plugin.addLineTool(type)
    }
  }

  toggleTool(type: LineToolType): void {
    if (this._activeTool === type) {
      this._activeTool = 'none'
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

  destroy(): void {
    if (this.selectionHandler) {
      this.plugin.unsubscribeLineToolsSingleClick(this.selectionHandler)
      this.selectionHandler = null
    }
    this.selectionListeners.clear()
    this.plugin.destroy()
  }
}
