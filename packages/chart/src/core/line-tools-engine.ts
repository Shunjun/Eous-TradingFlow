import { LineStyle } from 'lightweight-charts'
import type { IChartApi, ISeriesApi } from 'lightweight-charts'
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core'
import type {
  ILineToolsPlugin,
  LineToolsAfterEditEventParams,
  LineToolExport,
  LineToolType,
} from 'lightweight-charts-line-tools-core'
import { registerAllLineTools } from '../line-tools/registry'

export type DrawingStrokeStyle = LineStyle.Solid | LineStyle.Dashed | LineStyle.Dotted

export interface DrawingStyle {
  color: string
  width: number
  style: DrawingStrokeStyle
  opacity: number
}

export type SelectionChangeHandler = (hasSelection: boolean, style: DrawingStyle | null) => void
export type ActiveToolChangeHandler = (activeTool: LineToolType | 'none') => void
export type DrawingsDirtyChangeHandler = (dirtyCount: number) => void

export interface CachedDrawing {
  key: string
  payload: string
}

export class LineToolsEngine {
  private plugin: ILineToolsPlugin
  private chart: IChartApi
  private _activeTool: LineToolType | 'none' = 'none'
  private activeDrawingKey: string | null = null
  private drawingCache = new Map<string, string>()
  private dirtyDrawingKeys = new Set<string>()
  private selectionListeners = new Set<SelectionChangeHandler>()
  private activeToolListeners = new Set<ActiveToolChangeHandler>()
  private dirtyListeners = new Set<DrawingsDirtyChangeHandler>()
  private selectionHandler: (() => void) | null = null
  private afterEditHandler: ((params: LineToolsAfterEditEventParams) => void) | null = null

  constructor(chart: IChartApi, candleSeries: ISeriesApi<'Candlestick'>) {
    this.chart = chart
    this.plugin = createLineToolsPlugin(chart, candleSeries)
    registerAllLineTools(this.plugin)

    this.selectionHandler = () => this.emitSelectionChange()
    this.plugin.subscribeLineToolsSingleClick(this.selectionHandler)
    this.afterEditHandler = (params) => {
      this.captureActiveDrawing(true)
      this.emitSelectionChange()
      if (params.stage === 'lineToolFinished') {
        this.setActiveToolState('none')
        this.setChartNavigationEnabled(true)
      }
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
    this.captureActiveDrawing(true)
    this.emitSelectionChange()
  }

  getSelectedDrawingStyle(): DrawingStyle | null {
    const selected = this.getFirstSelectedTool()
    if (!selected) return null
    return readDrawingStyle(selected.options)
  }

  applySelectedDrawingStyle(updates: Partial<DrawingStyle>): DrawingStyle | null {
    const selected = this.getFirstSelectedTool()
    if (!selected) return null

    const current = readDrawingStyle(selected.options) ?? DEFAULT_DRAWING_STYLE
    const nextStyle = {
      color: updates.color ?? current.color,
      width: updates.width ?? current.width,
      style: updates.style ?? current.style,
      opacity: updates.opacity ?? current.opacity,
    }
    const nextTool = {
      ...selected,
      options: patchDrawingStyle(selected.options, nextStyle),
    } as LineToolExport<LineToolType>

    const applied = this.plugin.applyLineToolOptions(nextTool)
    if (!applied) return current

    this.captureActiveDrawing(true)
    this.emitSelectionChange()
    return nextStyle
  }

  exportTools(): string | null {
    return this.plugin.exportLineTools()
  }

  importTools(json: string): boolean {
    return this.plugin.importLineTools(json)
  }

  activateDrawingSet(key: string, remotePayload: string | null): void {
    this.captureActiveDrawing(false)
    this.plugin.removeAllLineTools()
    this.activeDrawingKey = key

    if (!this.drawingCache.has(key) && remotePayload !== null) {
      this.drawingCache.set(key, remotePayload)
    }

    const payload = this.drawingCache.get(key) ?? '[]'
    if (payload !== '[]') {
      this.plugin.importLineTools(payload)
    }
    this.emitSelectionChange()
  }

  getDirtyDrawings(): CachedDrawing[] {
    this.captureActiveDrawing(false)
    return Array.from(this.dirtyDrawingKeys).map((key) => ({
      key,
      payload: this.drawingCache.get(key) ?? '[]',
    }))
  }

  markDrawingsSaved(keys: string[]): void {
    for (const key of keys) {
      this.dirtyDrawingKeys.delete(key)
    }
    this.emitDirtyChange()
  }

  onDirtyChange(handler: DrawingsDirtyChangeHandler): () => void {
    this.dirtyListeners.add(handler)
    handler(this.dirtyDrawingKeys.size)
    return () => {
      this.dirtyListeners.delete(handler)
    }
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
    const style = hasSelection ? (this.getSelectedDrawingStyle() ?? DEFAULT_DRAWING_STYLE) : null
    for (const handler of this.selectionListeners) {
      handler(hasSelection, style)
    }
  }

  private getFirstSelectedTool(): LineToolExport<LineToolType> | null {
    try {
      const selected = JSON.parse(
        this.plugin.getSelectedLineTools(),
      ) as LineToolExport<LineToolType>[]
      return selected[0] ?? null
    } catch {
      return null
    }
  }

  private captureActiveDrawing(markDirty: boolean): void {
    if (!this.activeDrawingKey) return
    const payload = this.plugin.exportLineTools() ?? '[]'
    this.drawingCache.set(this.activeDrawingKey, payload)
    if (markDirty) {
      this.dirtyDrawingKeys.add(this.activeDrawingKey)
      this.emitDirtyChange()
    }
  }

  private emitDirtyChange(): void {
    const dirtyCount = this.dirtyDrawingKeys.size
    for (const handler of this.dirtyListeners) {
      handler(dirtyCount)
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
    this.dirtyListeners.clear()
    this.plugin.destroy()
  }
}

const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  color: '#f59e0b',
  width: 1,
  style: LineStyle.Solid,
  opacity: 1,
}

function readDrawingStyle(options: unknown): DrawingStyle | null {
  const record = asRecord(options)
  if (!record) return null

  const line = asRecord(record.line)
  if (line) {
    const lineColor = parseColor(typeof line.color === 'string' ? line.color : null)
    const levelColor = parseColor(readLevelColor(record))
    return {
      color: lineColor.color ?? levelColor.color ?? DEFAULT_DRAWING_STYLE.color,
      width: readNumber(line.width, DEFAULT_DRAWING_STYLE.width),
      style: readStrokeStyle(line.style),
      opacity: readOpacity(
        readLevelOpacity(record),
        lineColor.opacity ?? DEFAULT_DRAWING_STYLE.opacity,
      ),
    }
  }

  const border = readFirstBorder(record)
  if (border) {
    const borderColor = parseColor(typeof border.color === 'string' ? border.color : null)
    return {
      color: borderColor.color ?? DEFAULT_DRAWING_STYLE.color,
      width: readNumber(border.width, DEFAULT_DRAWING_STYLE.width),
      style: readStrokeStyle(border.style),
      opacity: borderColor.opacity ?? DEFAULT_DRAWING_STYLE.opacity,
    }
  }

  return null
}

function patchDrawingStyle<T>(options: T, style: DrawingStyle): T {
  const next = clone(options)
  const record = asRecord(next)
  if (!record) return next

  patchLine(record.line, style, true)
  patchBorder(record.rectangle, style)
  patchBorder(record.circle, style)
  patchBorder(record.triangle, style)
  patchBorder(asRecord(record.priceRange)?.rectangle, style)
  patchLine(asRecord(record.priceRange)?.verticalLine, style, true)
  patchLine(asRecord(record.priceRange)?.horizontalLine, style, true)
  patchLine(record.channelLine, style, true)
  patchLine(record.middleLine, style, true)
  patchFibLevels(record, style)
  patchMarketDepth(record.marketDepth, style)

  return next
}

function patchLine(target: unknown, style: DrawingStyle, includeColor: boolean): void {
  const line = asRecord(target)
  if (!line) return
  if (includeColor && 'color' in line) line.color = withOpacity(style.color, style.opacity)
  if ('width' in line) line.width = style.width
  if ('style' in line) line.style = style.style
}

function patchBorder(target: unknown, style: DrawingStyle): void {
  const border = asRecord(asRecord(target)?.border)
  if (!border) return
  border.color = withOpacity(style.color, style.opacity)
  border.width = style.width
  border.style = style.style
}

function patchFibLevels(target: Record<string, unknown>, style: DrawingStyle): void {
  if (!Array.isArray(target.levels)) return
  target.levels = target.levels.map((level) => {
    const record = asRecord(level)
    return record ? { ...record, color: style.color, opacity: style.opacity } : level
  })
}

function patchMarketDepth(target: unknown, style: DrawingStyle): void {
  const marketDepth = asRecord(target)
  if (!marketDepth) return
  marketDepth.lineWidth = style.width
  marketDepth.lineStyle = style.style
  if ('lineBidColor' in marketDepth)
    marketDepth.lineBidColor = withOpacity(style.color, style.opacity)
  if ('lineAskColor' in marketDepth)
    marketDepth.lineAskColor = withOpacity(style.color, style.opacity)
}

function readFirstBorder(record: Record<string, unknown>): Record<string, unknown> | null {
  for (const key of ['rectangle', 'circle', 'triangle']) {
    const border = asRecord(asRecord(record[key])?.border)
    if (border) return border
  }
  const priceRangeBorder = asRecord(asRecord(asRecord(record.priceRange)?.rectangle)?.border)
  return priceRangeBorder ?? null
}

function readLevelColor(record: Record<string, unknown>): string | null {
  if (!Array.isArray(record.levels)) return null
  const firstLevel = asRecord(record.levels[0])
  return typeof firstLevel?.color === 'string' ? firstLevel.color : null
}

function readLevelOpacity(record: Record<string, unknown>): unknown {
  if (!Array.isArray(record.levels)) return undefined
  return asRecord(record.levels[0])?.opacity
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function readOpacity(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return clamp(value, 0, 1)
}

function readStrokeStyle(value: unknown): DrawingStrokeStyle {
  if (value === LineStyle.Dashed) return LineStyle.Dashed
  if (value === LineStyle.Dotted || value === LineStyle.LargeDashed) return LineStyle.Dotted
  return LineStyle.Solid
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

function parseColor(value: string | null): { color: string | null; opacity: number | null } {
  if (!value) return { color: null, opacity: null }

  const hex = value.trim()
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    const [, r, g, b] = hex
    return { color: `#${r}${r}${g}${g}${b}${b}`.toLowerCase(), opacity: 1 }
  }
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    return { color: hex.toLowerCase(), opacity: 1 }
  }
  if (/^#[0-9a-f]{8}$/i.test(hex)) {
    const color = hex.slice(0, 7).toLowerCase()
    const opacity = parseInt(hex.slice(7, 9), 16) / 255
    return { color, opacity: clamp(opacity, 0, 1) }
  }

  const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(hex)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(',').map((part) => part.trim())
    const [r, g, b] = parts.slice(0, 3).map((part) => Number(part))
    if ([r, g, b].every((part) => Number.isFinite(part))) {
      return {
        color: rgbToHex(r, g, b),
        opacity: parts[3] === undefined ? 1 : clamp(Number(parts[3]), 0, 1),
      }
    }
  }

  return { color: value, opacity: 1 }
}

function withOpacity(color: string, opacity: number): string {
  const parsed = parseColor(color)
  const hex = parsed.color ?? color
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return color
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1).toFixed(2)})`
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((part) => clamp(Math.round(part), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
