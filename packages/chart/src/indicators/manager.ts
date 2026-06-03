import {
  LineSeries,
  HistogramSeries,
} from 'lightweight-charts'
import type { IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import type { IndicatorConfig, IndicatorOutput } from '../types'
import { INDICATOR_REGISTRY } from './registry'

// ── Instance Tracking ───────────────────────────────────────────────────────

interface IndicatorInstance {
  config: IndicatorConfig
  data: IndicatorOutput
  seriesRefs: ISeriesApi<'Line' | 'Histogram'>[]
  paneIndex: number | null
}

// ── IndicatorManager ────────────────────────────────────────────────────────

export class IndicatorManager {
  private chart: IChartApi
  private candleSeries: ISeriesApi<'Candlestick'>
  private closes: { time: Time; close: number }[] = []
  private instances: Map<string, IndicatorInstance> = new Map()

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) {
    this.chart = chart
    this.candleSeries = candleSeries
  }

  setCloses(closes: { time: Time; close: number }[]): void {
    this.closes = closes
  }

  addIndicator(config: IndicatorConfig): void {
    if (this.instances.has(config.id)) return

    const definition = INDICATOR_REGISTRY[config.type]
    if (!definition) return

    const data = definition.calculate(this.closes, config.params)
    const seriesRefs: ISeriesApi<'Line' | 'Histogram'>[] = []

    if (config.mode === 'overlay') {
      // Add series to main pane (pane 0)
      for (let i = 0; i < definition.seriesCount; i++) {
        const seriesType = definition.seriesTypes[i]
        const color = config.color ?? definition.defaultColors[i]

        if (seriesType === 'Line') {
          const s = this.chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceScaleId: `indicator-${config.id}-${i}`,
            lastValueVisible: false,
            priceLineVisible: false,
          }, 0)
          s.setData(data[i] ?? [])
          seriesRefs.push(s)
        } else {
          const s = this.chart.addSeries(HistogramSeries, {
            color,
            priceScaleId: `indicator-${config.id}-${i}`,
            lastValueVisible: false,
            priceLineVisible: false,
          }, 0)
          s.setData(data[i] ?? [])
          seriesRefs.push(s)
        }
      }
      this.instances.set(config.id, { config, data, seriesRefs, paneIndex: null })
    } else {
      // Split mode: create a new pane
      const pane = this.chart.addPane()
      const paneIdx = pane.paneIndex()
      pane.setStretchFactor(0.3)

      for (let i = 0; i < definition.seriesCount; i++) {
        const seriesType = definition.seriesTypes[i]
        const color = config.color ?? definition.defaultColors[i]

        if (seriesType === 'Line') {
          const s = this.chart.addSeries(LineSeries, {
            color,
            lineWidth: 1,
            priceScaleId: `indicator-${config.id}-${i}`,
            lastValueVisible: false,
            priceLineVisible: false,
          }, paneIdx)
          s.setData(data[i] ?? [])
          seriesRefs.push(s)
        } else {
          const s = this.chart.addSeries(HistogramSeries, {
            color,
            priceScaleId: `indicator-${config.id}-${i}`,
            lastValueVisible: false,
            priceLineVisible: false,
          }, paneIdx)
          s.setData(data[i] ?? [])
          seriesRefs.push(s)
        }
      }
      this.instances.set(config.id, { config, data, seriesRefs, paneIndex: paneIdx })
    }
  }

  removeIndicator(id: string): void {
    const instance = this.instances.get(id)
    if (!instance) return

    // Remove series
    for (const s of instance.seriesRefs) {
      this.chart.removeSeries(s)
    }

    // Remove pane if split
    if (instance.paneIndex !== null) {
      this.chart.removePane(instance.paneIndex)
    }

    this.instances.delete(id)
  }

  switchMode(id: string, newMode: 'overlay' | 'split'): void {
    const instance = this.instances.get(id)
    if (!instance || instance.config.mode === newMode) return

    if (newMode === 'split' && instance.paneIndex === null) {
      // overlay → split
      const pane = this.chart.addPane()
      const paneIdx = pane.paneIndex()
      pane.setStretchFactor(0.3)

      for (const s of instance.seriesRefs) {
        s.moveToPane(paneIdx)
      }
      instance.paneIndex = paneIdx
    } else if (newMode === 'overlay' && instance.paneIndex !== null) {
      // split → overlay
      const oldPane = instance.paneIndex
      for (const s of instance.seriesRefs) {
        s.moveToPane(0)
      }
      this.chart.removePane(oldPane)
      instance.paneIndex = null
    }

    instance.config.mode = newMode
  }

  moveUp(id: string): void {
    const instance = this.instances.get(id)
    if (!instance || instance.paneIndex === null || instance.paneIndex <= 1) return

    this.chart.swapPanes(instance.paneIndex, instance.paneIndex - 1)

    // Update pane indices
    for (const inst of this.instances.values()) {
      if (inst.paneIndex === instance.paneIndex - 1) {
        inst.paneIndex = instance.paneIndex
      }
    }
    instance.paneIndex = instance.paneIndex - 1
  }

  moveDown(id: string): void {
    const instance = this.instances.get(id)
    if (!instance || instance.paneIndex === null) return

    const panes = this.chart.panes()
    if (instance.paneIndex >= panes.length - 1) return

    this.chart.swapPanes(instance.paneIndex, instance.paneIndex + 1)

    // Update pane indices
    for (const inst of this.instances.values()) {
      if (inst.paneIndex === instance.paneIndex + 1) {
        inst.paneIndex = instance.paneIndex
      }
    }
    instance.paneIndex = instance.paneIndex + 1
  }

  recomputeAll(): void {
    for (const instance of this.instances.values()) {
      const definition = INDICATOR_REGISTRY[instance.config.type]
      if (!definition) continue

      instance.data = definition.calculate(this.closes, instance.config.params)

      for (let i = 0; i < instance.seriesRefs.length; i++) {
        instance.seriesRefs[i].setData(instance.data[i] ?? [])
      }
    }
  }

  updateConfig(id: string, updates: Partial<IndicatorConfig>): void {
    const instance = this.instances.get(id)
    if (!instance) return

    Object.assign(instance.config, updates)

    // If params changed, recompute
    if (updates.params) {
      const definition = INDICATOR_REGISTRY[instance.config.type]
      if (definition) {
        instance.data = definition.calculate(this.closes, instance.config.params)
        for (let i = 0; i < instance.seriesRefs.length; i++) {
          instance.seriesRefs[i].setData(instance.data[i] ?? [])
        }
      }
    }

    // If color changed, update series options
    if (updates.color) {
      const definition = INDICATOR_REGISTRY[instance.config.type]
      if (definition) {
        for (let i = 0; i < instance.seriesRefs.length; i++) {
          instance.seriesRefs[i].applyOptions({ color: updates.color })
        }
      }
    }
  }

  getInstances(): Map<string, IndicatorInstance> {
    return this.instances
  }

  hasIndicator(id: string): boolean {
    return this.instances.has(id)
  }

  destroy(): void {
    for (const id of [...this.instances.keys()]) {
      this.removeIndicator(id)
    }
  }
}
