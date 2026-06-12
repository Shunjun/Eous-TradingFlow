import { LineStyle } from 'lightweight-charts'
import type {
  Coordinate,
  IChartApiBase,
  IHorzScaleBehavior,
  ISeriesApi,
  SeriesType,
} from 'lightweight-charts'
import { ChartNoAxesCombined } from 'lucide-react'
import {
  AnchorPoint,
  BaseLineTool,
  CompositeRenderer,
  deepCopy,
  HitTestResult,
  HitTestType,
  LineToolPaneView,
  merge,
  PaneCursorType,
} from 'lightweight-charts-line-tools-core'
import type {
  CanvasRenderingTarget2D,
  DeepPartial,
  FibRetracementLevel,
  IPaneRenderer,
  LineToolHitTestData,
  LineToolOptionsInternal,
  LineToolPoint,
  LineToolType,
  LineToolsCorePlugin,
  PriceAxisLabelStackingManager,
} from 'lightweight-charts-line-tools-core'
import type { LineToolDefinition } from '../types'

interface FibLevelRenderData {
  coeff: number
  color: string
  opacity: number
  y: number
  priceText: string
}

interface FibRetracementRendererData {
  x0: number
  x1: number
  width: number
  levels: FibLevelRenderData[]
  lineWidth: number
  lineStyle: LineStyle
  extendLeft: boolean
  extendRight: boolean
  hoverCursor?: PaneCursorType
  dragCursor?: PaneCursorType
}

const DEFAULT_FIB_LEVELS: FibRetracementLevel[] = [
  { coeff: 0, color: '#787b86', opacity: 1, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
  {
    coeff: 0.236,
    color: '#f23645',
    opacity: 1,
    distanceFromCoeffEnabled: false,
    distanceFromCoeff: 0,
  },
  {
    coeff: 0.382,
    color: '#ff9800',
    opacity: 1,
    distanceFromCoeffEnabled: false,
    distanceFromCoeff: 0,
  },
  {
    coeff: 0.5,
    color: '#4caf50',
    opacity: 1,
    distanceFromCoeffEnabled: false,
    distanceFromCoeff: 0,
  },
  {
    coeff: 0.618,
    color: '#089981',
    opacity: 1,
    distanceFromCoeffEnabled: false,
    distanceFromCoeff: 0,
  },
  {
    coeff: 0.786,
    color: '#2962ff',
    opacity: 1,
    distanceFromCoeffEnabled: false,
    distanceFromCoeff: 0,
  },
  { coeff: 1, color: '#787b86', opacity: 1, distanceFromCoeffEnabled: false, distanceFromCoeff: 0 },
]

export const FibRetracementOptionDefaults: LineToolOptionsInternal<'FibRetracement'> = {
  visible: true,
  editable: true,
  defaultHoverCursor: PaneCursorType.Pointer,
  defaultDragCursor: PaneCursorType.Grabbing,
  defaultAnchorHoverCursor: PaneCursorType.Pointer,
  defaultAnchorDragCursor: PaneCursorType.Grabbing,
  notEditableCursor: PaneCursorType.NotAllowed,
  showPriceAxisLabels: true,
  showTimeAxisLabels: true,
  priceAxisLabelAlwaysVisible: false,
  timeAxisLabelAlwaysVisible: false,
  line: {
    width: 1,
    style: LineStyle.Solid,
  },
  extend: {
    left: false,
    right: true,
  },
  levels: DEFAULT_FIB_LEVELS,
  tradeStrategy: {
    enabled: false,
    longOrShort: '',
    fibBracketOrders: [],
  },
}

class FibRetracementRenderer implements IPaneRenderer {
  private data: FibRetracementRendererData | null = null

  setData(data: FibRetracementRendererData): void {
    this.data = data
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (!this.data || this.data.levels.length === 0) return

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      const data = this.data!
      const left = data.extendLeft ? 0 : Math.min(data.x0, data.x1)
      const right = data.extendRight ? data.width : Math.max(data.x0, data.x1)
      const lineLeft = Math.max(0, Math.min(left, data.width))
      const lineRight = Math.max(0, Math.min(right, data.width))
      const sortedLevels = [...data.levels].sort((a, b) => a.y - b.y)

      ctx.save()
      for (let index = 0; index < sortedLevels.length - 1; index += 1) {
        const top = sortedLevels[index]
        const bottom = sortedLevels[index + 1]
        const height = bottom.y - top.y
        if (height <= 0) continue
        ctx.fillStyle = withOpacity(
          bottom.color,
          Math.min(0.18, Math.max(0.04, bottom.opacity * 0.12)),
        )
        ctx.fillRect(lineLeft, top.y, lineRight - lineLeft, height)
      }

      ctx.lineWidth = data.lineWidth
      setCanvasLineStyle(ctx, data.lineStyle)
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.textBaseline = 'middle'

      for (const level of data.levels) {
        const y = crispLine(level.y, data.lineWidth)
        ctx.strokeStyle = withOpacity(level.color, level.opacity)
        ctx.beginPath()
        ctx.moveTo(lineLeft, y)
        ctx.lineTo(lineRight, y)
        ctx.stroke()

        ctx.fillStyle = withOpacity(level.color, Math.max(0.85, level.opacity))
        const label = `${formatCoeff(level.coeff)} ${level.priceText}`
        const labelX = Math.min(Math.max(lineLeft + 6, lineRight - 112), data.width - 112)
        ctx.fillText(label, labelX, y - 7)
      }
      ctx.restore()
    })
  }

  hitTest(x: Coordinate, y: Coordinate): HitTestResult<LineToolHitTestData> | null {
    if (!this.data) return null
    const left = this.data.extendLeft ? 0 : Math.min(this.data.x0, this.data.x1)
    const right = this.data.extendRight ? this.data.width : Math.max(this.data.x0, this.data.x1)
    if (x < left - 6 || x > right + 6) return null

    for (const level of this.data.levels) {
      if (Math.abs(y - level.y) <= 5) {
        return new HitTestResult(HitTestType.MovePointBackground, {
          pointIndex: null,
          suggestedCursor: this.data.dragCursor ?? PaneCursorType.Move,
        })
      }
    }
    return null
  }
}

class LineToolFibRetracementPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
  private readonly fibRenderer = new FibRetracementRenderer()

  constructor(
    source: LineToolFibRetracement<HorzScaleItem>,
    chart: IChartApiBase<HorzScaleItem>,
    series: ISeriesApi<SeriesType, HorzScaleItem>,
  ) {
    super(source, chart, series)
  }

  protected _updateImpl(_height: number, width: number): void {
    this._invalidated = false
    this._renderer.clear()

    const options = this._tool.options() as LineToolOptionsInternal<'FibRetracement'>
    if (!options.visible || this._tool.points().length < this._tool.pointsCount) return
    if (!this._updatePoints()) return

    const [point0, point1] = this._points
    const [logicalPoint0, logicalPoint1] = this._tool.points()
    if (!point0 || !point1 || !logicalPoint0 || !logicalPoint1) return

    const priceDelta = logicalPoint1.price - logicalPoint0.price
    const yDelta = point1.y - point0.y
    const formatter = this._tool.formatter()

    this.fibRenderer.setData({
      x0: point0.x,
      x1: point1.x,
      width,
      lineWidth: options.line.width,
      lineStyle: options.line.style,
      extendLeft: options.extend.left,
      extendRight: options.extend.right,
      hoverCursor: options.defaultHoverCursor,
      dragCursor: options.defaultDragCursor,
      levels: options.levels.map((level) => {
        const price = logicalPoint0.price + priceDelta * level.coeff
        return {
          coeff: level.coeff,
          color: level.color,
          opacity: level.opacity,
          y: point0.y + yDelta * level.coeff,
          priceText: formatter.format(price),
        }
      }),
    })
    this._renderer.append(this.fibRenderer)
    this._addAnchors(this._renderer as CompositeRenderer<HorzScaleItem>)
  }
}

export class LineToolFibRetracement<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {
  readonly toolType: LineToolType = 'FibRetracement'
  readonly pointsCount = 2

  constructor(
    coreApi: LineToolsCorePlugin<HorzScaleItem>,
    chart: IChartApiBase<HorzScaleItem>,
    series: ISeriesApi<SeriesType, HorzScaleItem>,
    horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
    options: DeepPartial<LineToolOptionsInternal<'FibRetracement'>> | undefined = {},
    points: LineToolPoint[] | undefined = [],
    priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>,
  ) {
    const finalOptions = deepCopy(FibRetracementOptionDefaults)
    merge(finalOptions, options ?? {})
    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      'FibRetracement',
      2,
      priceAxisLabelStackingManager,
    )
    this._setPaneViews([new LineToolFibRetracementPaneView(this, this._chart, this._series)])
  }

  maxAnchorIndex(): number {
    return 1
  }

  supportsClickClickCreation(): boolean {
    return true
  }

  supportsClickDragCreation(): boolean {
    return true
  }

  supportsShiftClickClickConstraint(): boolean {
    return true
  }

  supportsShiftClickDragConstraint(): boolean {
    return true
  }

  _internalHitTest(x: Coordinate, y: Coordinate): HitTestResult<LineToolHitTestData> | null {
    const view = this._paneViews[0] as LineToolFibRetracementPaneView<HorzScaleItem> | undefined
    return view?.renderer()?.hitTest?.(x, y) ?? null
  }
}

export const FibRetracementDefinition: LineToolDefinition = {
  type: 'FibRetracement',
  label: 'Fib Retracement',
  icon: ChartNoAxesCombined,
  register(plugin) {
    plugin.registerLineTool('FibRetracement', LineToolFibRetracement as any)
  },
}

function formatCoeff(coeff: number): string {
  const percent = coeff * 100
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(1)}%`
}

function withOpacity(color: string, opacity: number): string {
  if (!color.startsWith('#')) return color
  const hex = color.slice(1)
  const value =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => part + part)
          .join('')
      : hex
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, opacity))})`
}

function crispLine(value: number, lineWidth: number): number {
  return lineWidth % 2 === 1 ? Math.round(value) + 0.5 : Math.round(value)
}

function setCanvasLineStyle(ctx: CanvasRenderingContext2D, style: LineStyle): void {
  if (style === LineStyle.Dashed) {
    ctx.setLineDash([8, 4])
  } else if (style === LineStyle.Dotted || style === LineStyle.LargeDashed) {
    ctx.setLineDash([2, 4])
  } else if (style === LineStyle.SparseDotted) {
    ctx.setLineDash([2, 8])
  } else {
    ctx.setLineDash([])
  }
}
