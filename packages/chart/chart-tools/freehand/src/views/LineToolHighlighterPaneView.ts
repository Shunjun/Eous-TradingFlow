// lightweight-charts-line-tools-freehand/src/views/LineToolHighlighterPaneView.ts

import { IChartApiBase, ISeriesApi, SeriesType, Coordinate } from 'lightweight-charts'

import {
  BaseLineTool,
  LineToolPaneView,
  CompositeRenderer,
  PolygonRenderer,
  PolygonRendererData,
  AnchorPoint,
  LineToolOptionsInternal,
  deepCopy,
  LineOptions,
  BackgroundOptions,
  merge,
  PaneCursorType,
  LineToolPoint,
} from 'lightweight-charts-line-tools-core'

import { LineToolHighlighter } from '../model/LineToolHighlighter'

/**
 * Pane View for the Highlighter tool.
 *
 * **Tutorial Note on Logic:**
 * This view is structurally very similar to the {@link LineToolBrushPaneView}.
 * It converts the stream of logical points into screen coordinates, applies a smoothing
 * algorithm to create fluid strokes, and renders the result using a `PolygonRenderer`.
 *
 * The primary difference lies in the configuration passed from the Model (thicker, translucent lines).
 */
export class LineToolHighlighterPaneView<HorzScaleItem> extends LineToolPaneView<HorzScaleItem> {
  /**
   * Internal renderer responsible for drawing the thick, freehand highlighter stroke.
   * @protected
   */
  protected _polygonRenderer: PolygonRenderer<HorzScaleItem> = new PolygonRenderer()

  /**
   * Initializes the Highlighter View.
   *
   * @param source - The specific Highlighter model instance.
   * @param chart - The Chart API.
   * @param series - The Series API.
   */
  public constructor(
    source: LineToolHighlighter<HorzScaleItem>, // Accepts the specific Highlighter Model type
    chart: IChartApiBase<any>,
    series: ISeriesApi<SeriesType, any>,
  ) {
    super(source as BaseLineTool<any>, chart, series)
  }

  /**
   * Smooths the raw path points using an iterative moving average algorithm.
   *
   * This algorithm reduces the "jitter" from raw mouse input, resulting in a cleaner
   * looking highlight stroke. It uses the same logic as the Brush tool to ensure consistent feel.
   *
   * @param points - The raw screen points.
   * @param iterations - Number of smoothing passes (default 2).
   * @returns The smoothed array of points.
   * @protected
   */
  protected _smoothArray(points: AnchorPoint[], iterations: number = 2): AnchorPoint[] {
    if (points.length <= 2 || iterations === 0) {
      return points
    }

    // Use a simple, iterative moving average (box blur kernel)
    let smoothedPoints = points.map((p) => p.clone())
    const windowSize = 3 // Window of [previous, current, next]

    for (let i = 0; i < iterations; i++) {
      const currentIterationPoints = smoothedPoints.map((p) => p.clone())

      for (let j = 1; j < smoothedPoints.length - 1; j++) {
        const prev = smoothedPoints[j - 1]
        const current = smoothedPoints[j]
        const next = smoothedPoints[j + 1]

        // Calculate new position as the average of the window
        const avgX = (prev.x + current.x + next.x) / windowSize
        const avgY = (prev.y + current.y + next.y) / windowSize

        currentIterationPoints[j].x = avgX as Coordinate
        currentIterationPoints[j].y = avgY as Coordinate
      }
      smoothedPoints = currentIterationPoints
    }

    return smoothedPoints
  }

  /**
   * The core update logic.
   *
   * It manages visibility (culling), coordinate conversion, path smoothing, and finally
   * configuring the renderer with the specific visual options (color, width, opacity).
   *
   * @param height - The height of the pane.
   * @param width - The width of the pane.
   * @protected
   * @override
   */
  protected override _updateImpl(height: number, width: number): void {
    this._invalidated = false
    this._renderer.clear()

    // Trust that the model's options are correct (Highlighter options)
    const options = this._tool.options() as LineToolOptionsInternal<'Highlighter'>

    /**
     * CULLING CHECK
     *
     * We query the Model's pre-calculated state. This check now handles
     * the total bounding box intersection for the entire freehand path.
     */
    if (this._tool.isCulled()) {
      //console.log('highlighter culled')
      return
    }

    // 1. Convert logical points to raw screen coordinates
    const hasScreenPoints = this._updatePoints() // Populates this._points (raw screen points)

    if (!options.visible || !hasScreenPoints || this._points.length === 0) {
      return
    }

    // 2. Apply Smoothing (The V3.8 Step 2)

    /**
     * PATH SMOOTHING
     *
     * We apply the smoothing algorithm to the raw screen points.
     * This is crucial for Highlighters, as the thick line width makes jittery input
     * visually obvious and unappealing.
     */
    const smoothedPoints = this._smoothArray(this._points, 2)

    // 3. Configure Renderers (The V3.8 Step 3)
    const finalLineOptions = options.line as LineOptions

    // Determine final background data for the renderer
    let finalBackgroundData: { color: string } | undefined = undefined
    if (options.background && options.background.color) {
      finalBackgroundData = { color: options.background.color }
    }

    /**
     * POLYGON RENDERER DATA SETUP
     *
     * We configure the `PolygonRenderer` with the **smoothed** points.
     * - `line`: Contains the specific highlighter styling (e.g., width: 20px, opacity: 0.4).
     * - `background`: Handles optional fill if configured (though highlighters are usually just thick strokes).
     */
    const polygonRendererData: PolygonRendererData = {
      points: smoothedPoints,
      line: finalLineOptions,
      background: finalBackgroundData,
      hitTestBackground: false,
      toolDefaultHoverCursor: options.defaultHoverCursor,
      toolDefaultDragCursor: options.defaultDragCursor,
    }

    this._polygonRenderer.setData(polygonRendererData)

    ;(this._renderer as CompositeRenderer<HorzScaleItem>).append(this._polygonRenderer)

    // 4. Add Anchors
    //if (this.areAnchorsVisible()) {
    this._addAnchors(this._renderer as CompositeRenderer<HorzScaleItem>)
    //}
  }

  /**
   * Adds the interactive anchor point.
   *
   * **Tutorial Note:**
   * Like the Brush, we calculate the geometric center of the highlight path and place a
   * single "Move Handle" there. This allows the user to reposition the specific highlight
   * annotation without needing to interact with every single point in the path.
   *
   * @param renderer - The composite renderer to append anchors to.
   * @protected
   * @override
   */
  protected override _addAnchors(renderer: CompositeRenderer<HorzScaleItem>): void {
    if (this._points.length === 0) return

    // Find the center of the bounding box of the drawn points
    const avgX = this._points.reduce((sum, p) => sum + p.x, 0) / this._points.length
    const avgY = this._points.reduce((sum, p) => sum + p.y, 0) / this._points.length

    // Create a single anchor point at the center (arbitrarily assign pointIndex 0)
    const centerAnchor = new AnchorPoint(avgX, avgY, 0, true)
    const anchorData = {
      points: [centerAnchor],
      pointsCursorType: [PaneCursorType.Grabbing],
    }

    // Add the anchor renderer.
    renderer.append(this.createLineAnchor(anchorData, 0))
  }
}
