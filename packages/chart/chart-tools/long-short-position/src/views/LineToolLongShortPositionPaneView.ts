// /lightweight-charts-line-tools-long-short-position/src/views/LineToolLongShortPositionPaneView.ts

/**
 * The Pane View for the LineToolLongShortPosition tool.
 * It coordinates the rendering of the two rectangles (Risk and Reward) and the
 * associated dynamic text labels, managed by the core plugin's renderers.
 */

import { IChartApiBase, ISeriesApi, SeriesType, Coordinate, LineStyle } from 'lightweight-charts'

import {
  BaseLineTool,
  IPaneRenderer,
  RectangleRenderer,
  TextRenderer,
  CompositeRenderer,
  LineToolPaneView,
  AnchorPoint,
  LineToolOptionsInternal,
  TextRendererData,
  RectangleRendererData,
  PaneCursorType,
  LineToolHitTestData,
  HitTestResult,
  deepCopy,
  TextAlignment,
  BoxHorizontalAlignment,
  BoxVerticalAlignment,
  Point,
  DeepPartial,
  TextOptions,
  merge,
  LineToolPoint,
  LineToolCullingInfo,
  RectangleOptions,
  ensureNotNull,
  interpolateLogicalIndexFromTime,
} from 'lightweight-charts-line-tools-core'

import { LineToolLongShortPosition } from '../model/LineToolLongShortPosition'

/**
 * The Pane View for the Long/Short Position tool.
 *
 * **Tutorial Note on Logic:**
 * This view coordinates a complex multi-part visualization:
 * 1. **Risk Rectangle:** Red box defining the loss zone (Entry to Stop).
 * 2. **Reward Rectangle:** Green box defining the profit zone (Entry to Target).
 * 3. **Dynamic Labels:** Two separate text renderers that auto-calculate and display
 *    prices, distances, and R:R ratios based on the current geometry.
 *
 * It manages independent culling for the two halves to optimize performance when zooming.
 */
export class LineToolLongShortPositionPaneView<
  HorzScaleItem,
> extends LineToolPaneView<HorzScaleItem> {
  // Custom renderers for the tool's components
  /**
   * Internal renderer for the Stop Loss (Risk) rectangle.
   * @protected
   */
  protected _riskRenderer: RectangleRenderer<HorzScaleItem> = new RectangleRenderer()

  /**
   * Internal renderer for the Profit Target (Reward) rectangle.
   * @protected
   */
  protected _rewardRenderer: RectangleRenderer<HorzScaleItem> = new RectangleRenderer()

  /**
   * Internal renderer for the text statistics in the Risk zone.
   * @protected
   */
  protected _riskLabelRenderer: TextRenderer<HorzScaleItem> = new TextRenderer()

  /**
   * Internal renderer for the text statistics in the Reward zone.
   * @protected
   */
  protected _rewardLabelRenderer: TextRenderer<HorzScaleItem> = new TextRenderer()

  /**
   * Initializes the Position Tool View.
   *
   * @param tool - The specific Long/Short model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  public constructor(
    tool: LineToolLongShortPosition<HorzScaleItem>,
    chart: IChartApiBase<any>,
    series: ISeriesApi<SeriesType, any>,
  ) {
    // Call the super constructor (LineToolPaneView) to initialize common properties
    super(tool as BaseLineTool<HorzScaleItem>, chart, series)
  }

  /**
   * Converts logical points to screen points.
   * Overridden to utilize the Core's interpolation math for the "Blank Space".
   * This version is resilient to fractional prices and off-screen targets.
   */
  protected override _updatePoints(): boolean {
    const priceScale = this._tool.priceScale()
    if (!priceScale) return false

    this._points = []
    const sourcePoints = this._tool.points()

    for (let i = 0; i < sourcePoints.length; i++) {
      // We use the tool's built-in converter.
      // In Long mode, if the price is off the top, this might return null.
      const point = this._tool.pointToScreenPoint(sourcePoints[i]) as AnchorPoint

      // We push the result (even if null) to keep the array indices
      // aligned with [Entry, Stop, Target].
      if (point) {
        point.data = i
      }
      this._points.push(point)
    }

    // As long as the Entry point exists (index 0), we allow the draw to proceed.
    // If the chart returns null for P0, something is fundamentally wrong.
    return !!this._points[0]
  }

  /**
   * The master rendering loop responsible for compositing the tool's visual elements.
   *
   * This method resolves the screen coordinates for the Entry, Stop, and Target points
   * and configures the individual renderers for the Risk (Red) and Reward (Green)
   * zones.
   *
   * **Stability Features:**
   * 1. **Hard Reset:** Clears the composite renderer to prevent "Ghosting" artifacts.
   * 2. **Culling Integration:** Aborts the render early if the Model determines the
   *    tool is off-screen, saving significant CPU resources.
   * 3. **NaN Escape Hatch:** Detects corrupted mathematical states and skips
   *    drawing specific components instead of rendering "Infinite" lines.
   * 4. **Verticality Enforcement:** Forces the Profit Target to share the exact
   *    pixel X-coordinate of the Stop Loss to guarantee a perfectly rectangular look.
   *
   * @param height - The current pixel height of the chart pane.
   * @param width - The current pixel width of the chart pane.
   * @protected
   * @override
   */
  protected override _updateImpl(height: number, width: number): void {
    this._invalidated = false
    this._renderer.clear()

    const tool = this._tool as LineToolLongShortPosition<HorzScaleItem>
    const options = tool.options() as LineToolOptionsInternal<'LongShortPosition'>

    if (!options.visible) return

    /**
     * 3. CULLING CHECK
     * If the parent tool has been determined to be off-screen by the Model's
     * geometric culling engine, we skip all geometry and label calculations.
     * Since we just cleared the renderer, this ensures nothing is drawn.
     */
    if (this._tool.isCulled()) {
      //console.log('long short position culled')
      return
    }

    if (!this._updatePoints()) return

    const pts = tool.points()
    if (pts.length < 2) return

    const compositeRenderer = this._renderer as CompositeRenderer<HorzScaleItem>

    // --- 1. COORDINATE RESOLUTION ---
    const entryBase = tool.pointToScreenPoint(pts[0])
    const stopBase = tool.pointToScreenPoint(pts[1])

    if (!entryBase || !stopBase) return

    const P_Entry_Screen = new AnchorPoint(entryBase.x, entryBase.y, 0)
    const P_Stop_Screen = new AnchorPoint(stopBase.x, stopBase.y, 1)

    /**
     * Helper to get Y coordinate with strict numeric shielding.
     */
    const getY = (price: any): number | null => {
      const numPrice = Number(price)
      if (!isFinite(numPrice)) return null

      const y = this._series.priceToCoordinate(numPrice)
      if (y === null) {
        return numPrice > Number(pts[0].price) ? -1000 : height + 1000
      }
      return y
    }

    // Resolve PT point screen position
    let P_PT_Screen: AnchorPoint | null = null
    if (pts.length >= 3) {
      const ptY = getY(pts[2].price)
      if (ptY !== null) {
        P_PT_Screen = new AnchorPoint(P_Stop_Screen.x, ptY as Coordinate, 2)
      }
    }

    const isLong = tool.isCurrentLong()

    // --- 2. Risk Rectangle (Entry to Stop) ---
    this._riskRenderer.setData({
      ...deepCopy(options.entryStopLossRectangle),
      points: [P_Entry_Screen, P_Stop_Screen],
      hitTestBackground: false,
    })
    compositeRenderer.append(this._riskRenderer)

    // --- 3. Reward Rectangle (Entry to Target) ---
    if (P_PT_Screen) {
      this._rewardRenderer.setData({
        ...deepCopy(options.entryPtRectangle),
        points: [P_Entry_Screen, P_PT_Screen],
        hitTestBackground: false,
      })
      compositeRenderer.append(this._rewardRenderer)
    }

    // --- 4. Dynamic Auto-Text Labels ---
    if (options.showAutoText) {
      const defaultAutoTextStyle: DeepPartial<TextOptions> = {
        font: { color: 'white', size: 12, bold: true, family: 'sans-serif' },
        box: {
          background: { color: 'rgba(0, 0, 0, 0)' },
          alignment: {
            vertical: BoxVerticalAlignment.Middle,
            horizontal: BoxHorizontalAlignment.Center,
          },
        },
        padding: 4,
      }

      const priceFormatter = this._series.priceFormatter()
      const entryP = Number(pts[0].price)
      const stopP = Number(pts[1].price)
      const riskDist = Math.abs(entryP - stopP)

      // 4.1 Risk Label
      const riskOpt = merge(
        deepCopy(defaultAutoTextStyle),
        options.entryStopLossText,
      ) as TextOptions
      const riskStats = `Entry: ${priceFormatter.format(entryP)}\nStop: ${priceFormatter.format(stopP)}\nRisk: ${priceFormatter.format(riskDist)}`
      riskOpt.value =
        riskOpt.value?.trim().length > 0 ? `${riskStats}\n${riskOpt.value}` : riskStats
      riskOpt.box.alignment.vertical = isLong
        ? BoxVerticalAlignment.Bottom
        : BoxVerticalAlignment.Top

      this._riskLabelRenderer.setData({
        text: riskOpt,
        points: [P_Entry_Screen, P_Stop_Screen],
        hitTestBackground: true,
        toolDefaultHoverCursor: options.defaultHoverCursor,
        toolDefaultDragCursor: options.defaultDragCursor,
      })
      compositeRenderer.append(this._riskLabelRenderer)

      // 4.2 Reward Label
      if (P_PT_Screen && pts[2]) {
        const targetP = Number(pts[2].price)
        const rewardDist = Math.abs(entryP - targetP)
        const rrValue = riskDist !== 0 ? (rewardDist / riskDist).toFixed(2) : '0.00'

        const rewardOpt = merge(deepCopy(defaultAutoTextStyle), options.entryPtText) as TextOptions
        const rewardStats = `PT: ${priceFormatter.format(targetP)}\nReward: ${priceFormatter.format(rewardDist)}\nR:R: ${rrValue}`
        rewardOpt.value =
          rewardOpt.value?.trim().length > 0 ? `${rewardStats}\n${rewardOpt.value}` : rewardStats
        rewardOpt.box.alignment.vertical = isLong
          ? BoxVerticalAlignment.Top
          : BoxVerticalAlignment.Bottom

        this._rewardLabelRenderer.setData({
          text: rewardOpt,
          points: [P_Entry_Screen, P_PT_Screen],
          hitTestBackground: true,
          toolDefaultHoverCursor: options.defaultHoverCursor,
          toolDefaultDragCursor: options.defaultDragCursor,
        })
        compositeRenderer.append(this._rewardLabelRenderer)
      }
    }

    this._addAnchors(compositeRenderer)
  }

  /**
   * Adds the three interactive anchor points (Entry, Stop, Target).
   *
   * We assign `VerticalResize` cursors to all three because the primary interaction mode
   * for adjusting this tool is dragging the price levels up and down.
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  protected override _addAnchors(renderer: CompositeRenderer<any>): void {
    if (this._points.length < 3) return

    // Entry, Stop, PT
    const entryAnchor = this._points[0]
    const stopAnchor = this._points[1]
    const ptAnchor = this._points[2]

    entryAnchor.specificCursor = PaneCursorType.VerticalResize
    stopAnchor.specificCursor = PaneCursorType.VerticalResize
    ptAnchor.specificCursor = PaneCursorType.VerticalResize

    renderer.append(
      this.createLineAnchor(
        {
          points: [entryAnchor, stopAnchor, ptAnchor],
          defaultAnchorHoverCursor: PaneCursorType.VerticalResize,
          defaultAnchorDragCursor: PaneCursorType.VerticalResize,
        },
        0,
      ),
    )
  }
}
