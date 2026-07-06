// /lightweight-charts-line-tools-long-short-position/src/model/LineToolLongShortPosition.ts

import {
  IChartApiBase,
  ISeriesApi,
  IHorzScaleBehavior,
  LineStyle,
  SeriesType,
  Coordinate,
} from 'lightweight-charts'
import {
  BaseLineTool,
  LineToolPoint,
  LineToolType,
  LineToolOptionsInternal,
  TextOptions,
  merge,
  DeepPartial,
  LineToolPartialOptionsMap,
  TextAlignment,
  BoxVerticalAlignment,
  BoxHorizontalAlignment,
  PaneCursorType,
  LineToolsCorePlugin,
  deepCopy,
  PriceAxisLabelStackingManager,
  ensureNotNull,
  HitTestResult,
  CompositeRenderer,
  Point,
  InteractionPhase,
  ConstraintResult,
  getToolCullingState,
  OffScreenState,
  ExtendOptions,
} from 'lightweight-charts-line-tools-core'
import { LineToolLongShortPositionPaneView } from '../views/LineToolLongShortPositionPaneView'

/**
 * Defines the default configuration options for the Long/Short Position tool.
 *
 * **Tutorial Note:**
 * This tool is visually composed of two distinct zones:
 * 1. **Risk Zone (Stop Loss):** Red rectangle (`entryStopLossRectangle`) + Text.
 * 2. **Reward Zone (Profit Target):** Green rectangle (`entryPtRectangle`) + Text.
 *
 * The defaults configure these with standard trading colors (Red/Green) and enable
 * the "Auto Text" feature (`showAutoText: true`) which automatically calculates and displays
 * the Risk/Reward ratio and price levels.
 */
export const LongShortPositionOptionDefaults: LineToolOptionsInternal<'LongShortPosition'> = {
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

  showAutoText: true,
  entryStopLossRectangle: {
    background: { color: 'rgba(255, 0, 0, 0.2)' },
    border: { width: 1, style: LineStyle.Solid, color: 'rgba(255, 0, 0, 1)', radius: 0 },
    extend: { left: false, right: false },
  },
  entryPtRectangle: {
    background: { color: 'rgba(0, 128, 0, 0.2)' },
    border: { width: 1, style: LineStyle.Solid, color: 'rgba(0, 255, 0, 1)', radius: 0 },
    extend: { left: false, right: false },
  },
  entryStopLossText: {
    value: '',
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
    alignment: TextAlignment.Left,
    font: {
      color: 'rgba(255, 255, 255, 1)',
      size: 12,
      bold: false,
      italic: false,
      family: 'sans-serif',
    },
    box: {
      alignment: {
        vertical: BoxVerticalAlignment.Middle,
        horizontal: BoxHorizontalAlignment.Center,
      },
      angle: 0,
      scale: 1,
      offset: { x: 0, y: 0 },
      padding: { x: 0, y: 0 },
      maxHeight: 0,
      shadow: { blur: 0, color: 'rgba(0, 0, 0, 0)', offset: { x: 0, y: 0 } },
      border: {
        color: 'rgba(0, 0, 0, 0)',
        width: 0,
        radius: 0,
        highlight: false,
        style: LineStyle.Solid,
      },
      background: { color: 'rgba(0, 0, 0, 0)', inflation: { x: 0, y: 0 } },
    },
  },
  entryPtText: {
    value: '',
    padding: 0,
    wordWrapWidth: 0,
    forceTextAlign: false,
    forceCalculateMaxLineWidth: false,
    alignment: TextAlignment.Left,
    font: {
      color: 'rgba(255, 255, 255, 1)',
      size: 12,
      bold: false,
      italic: false,
      family: 'sans-serif',
    },
    box: {
      alignment: {
        vertical: BoxVerticalAlignment.Middle,
        horizontal: BoxHorizontalAlignment.Center,
      },
      angle: 0,
      scale: 1,
      offset: { x: 0, y: 0 },
      padding: { x: 0, y: 0 },
      maxHeight: 0,
      shadow: { blur: 0, color: 'rgba(0, 0, 0, 0)', offset: { x: 0, y: 0 } },
      border: {
        color: 'rgba(0, 0, 0, 0)',
        width: 0,
        radius: 0,
        highlight: false,
        style: LineStyle.Solid,
      },
      background: { color: 'rgba(0, 0, 0, 0)', inflation: { x: 0, y: 0 } },
    },
  },
}

/**
 * Concrete implementation of the Long/Short Position drawing tool.
 *
 * **What is a Position Tool?**
 * It is a risk management tool defined by **3 logical points**:
 * 1. **Entry Price (P0):** The start of the trade.
 * 2. **Stop Loss (P1):** The invalidation point.
 * 3. **Profit Target (P2):** The target exit point.
 *
 * **Complex Logic:**
 * Unlike simple shapes, this tool has "Business Logic":
 * - It detects direction (Long if Stop < Entry, Short if Stop > Entry).
 * - It calculates Risk:Reward ratios.
 * - It handles "Flipping" (changing colors/direction when Entry crosses Stop).
 */
export class LineToolLongShortPosition<HorzScaleItem> extends BaseLineTool<HorzScaleItem> {
  /**
   * The unique identifier for this tool type ('LongShortPosition').
   *
   * @override
   */
  public override readonly toolType: LineToolType = 'LongShortPosition'

  /**
   * Defines the number of anchor points required to draw this tool.
   *
   * A Position tool requires exactly **3 points** (Entry, Stop, Target). User defines 2 points on creation, the 3rd point
   * which is the target is generated on creation and can be modified after creation
   *
   * @override
   */
  public override readonly pointsCount: number = 3

  /**
   * Explicitly defines the highest valid index for an interactive anchor point.
   *
   * We support 3 interactive handles:
   * - **0:** Entry Price.
   * - **1:** Stop Loss.
   * - **2:** Profit Target.
   *
   * @override
   * @returns `2`
   */
  public override maxAnchorIndex(): number {
    return 2
  }

  private _clickCount: number = 0
  private _isLong: boolean | null = null
  private _flipModeActive: boolean = false

  /**
   * Confirms that this tool is created via the "Click-Click" method.
   *
   * **Interaction Flow:**
   * 1. Click Entry.
   * 2. Click Stop Loss.
   * 3. (Auto) Profit Target is initially generated at 3R (3x Risk) automatically.
   *
   * @override
   * @returns `true`
   */
  public supportsClickClickCreation(): boolean {
    return true
  }

  /**
   * Indicates if the tool supports "Click-Drag" creation.
   *
   * We disable this (`false`) to enforce precision. Placing Entry and Stop Loss
   * usually requires exact clicking rather than a sweeping drag motion.
   *
   * @override
   * @returns `false`
   */
  public supportsClickDragCreation(): boolean {
    return false
  }

  /**
   * Enables geometric constraints (Shift key) during creation.
   *
   * If `true`, holding Shift while placing points will apply the logic defined in
   * {@link getShiftConstrainedPoint} (typically locking the price level to prevent drift).
   *
   * @override
   * @returns `true`
   */
  public supportsShiftClickClickConstraint(): boolean {
    return true
  }

  /**
   * Indicates if holding Shift should apply geometric constraints during drag creation.
   *
   * Not applicable as `supportsClickDragCreation` is false.
   *
   * @override
   * @returns `false`
   */
  public supportsShiftClickDragConstraint(): boolean {
    return false
  }

  /**
   * Initializes the Long/Short Position tool.
   *
   * **Tutorial Note on Logic:**
   * 1. **Defaults:** Merges defaults with user options.
   * 2. **Legacy Handling:** Checks if `points` contains only 2 points (Entry/Stop). If so,
   *    it auto-calculates and pushes a 3rd point (Profit Target) to ensure the tool is valid.
   * 3. **Direction Inference:** Determines if the tool is "Long" or "Short" based on P0 vs P1.
   * 4. **View:** Assigns `LineToolLongShortPositionPaneView` for complex multi-rect rendering.
   *
   * @param coreApi - The Core Plugin API.
   * @param chart - The Lightweight Charts Chart API.
   * @param series - The Series API this tool is attached to.
   * @param horzScaleBehavior - The horizontal scale behavior.
   * @param options - Configuration overrides.
   * @param points - Initial points.
   * @param priceAxisLabelStackingManager - The manager for label collision.
   */
  public constructor(
    coreApi: LineToolsCorePlugin<HorzScaleItem>,
    chart: IChartApiBase<HorzScaleItem>,
    series: ISeriesApi<SeriesType, HorzScaleItem>,
    horzScaleBehavior: IHorzScaleBehavior<HorzScaleItem>,
    options: DeepPartial<LineToolOptionsInternal<'LongShortPosition'>> = {},
    points: LineToolPoint[] = [],
    priceAxisLabelStackingManager: PriceAxisLabelStackingManager<HorzScaleItem>,
  ) {
    const finalOptions = deepCopy(
      LongShortPositionOptionDefaults,
    ) as LineToolOptionsInternal<'LongShortPosition'>
    merge(finalOptions, options as LineToolPartialOptionsMap['LongShortPosition'])

    super(
      coreApi,
      chart,
      series,
      horzScaleBehavior,
      finalOptions,
      points,
      'LongShortPosition',
      3, // FIX: Pass 3 to super
      priceAxisLabelStackingManager,
    )

    // Properly initialize state flags when loading existing/saved tools.
    if (this._points.length >= 2) {
      this._clickCount = 2

      // legacy/partial data (missing PT)
      // If we have Entry & Stop but no PT, generate the default 3R PT immediately.
      if (this._points.length < 3) {
        const p0 = this._points[0]
        const p1 = this._points[1]
        // We can safely call this because p0 and p1 exist
        const p2 = this.calculateProfitTarget(p0, p1, p1.timestamp)
        this._points.push(p2)
      }

      const entryPrice = this._points[0].price
      const stopPrice = this._points[1].price

      if (entryPrice === stopPrice) {
        // Edge Case: Zero Risk (collapsed tool).
        // Attempt to infer direction from Profit Target (P2) if it exists.
        if (this._points.length >= 3) {
          const ptPrice = this._points[2].price
          // If PT is below Entry, it implies a Short position. Otherwise, default to Long.
          this._isLong = ptPrice < entryPrice ? false : true
        } else {
          // Fallback: Default to Long if no PT context is available
          this._isLong = true
        }
      } else {
        // Standard Case: Direction derived strictly from Entry vs Stop
        this._isLong = entryPrice > stopPrice
      }
    }

    this._setPaneViews([new LineToolLongShortPositionPaneView(this, this._chart, this._series)])
  }

  /**
   * Determines the current trade direction (Long vs Short) based on the vertical relationship
   * between the Entry and Stop Loss anchors.
   *
   * ### Sticky Logic & Recursion Safety
   * 1. **Sticky Threshold:** If the Entry and Stop Loss prices are exactly equal (during a
   *    crossover tick), the tool maintains its previous direction to prevent flickering.
   * 2. **Direct Access:** This method reads raw data points directly rather than calling
   *    `this.points()`, effectively breaking the infinite recursion loop that occurs
   *    during tool creation.
   * 3. **Numeric Comparison:** Forces numeric casting to ensure decimal values (e.g., "10.25")
   *    are compared mathematically rather than alphabetically.
   *
   * @returns `true` if the setup is Long (Entry > Stop), `false` if Short.
   */
  public isCurrentLong(): boolean {
    const p0 = this._points[0]
    const p1 = this._points[1] || this._lastPoint

    if (!p0 || !p1) return this._isLong ?? true

    const p0Price = Number(p0.price)
    const p1Price = Number(p1.price)

    // --- FIX: The Dead Zone / Sticky Logic ---
    // If prices are equal, do not change direction.
    if (Math.abs(p0Price - p1Price) < 1e-10) {
      return this._isLong ?? true
    }

    return p0Price > p1Price
  }

  /**
   * Helper to retrieve the base text styling options for the auto-generated labels.
   *
   * Used internally or by views to ensure consistency when rendering the dynamic text stats.
   *
   * @returns A deep copy of the `entryStopLossText` options.
   */
  public getAutoTextBaseOptions(): TextOptions {
    const currentOptions = this.options()
    return deepCopy(currentOptions.entryStopLossText) as TextOptions
  }

  /**
   * Retrieves the internally cached direction state.
   *
   * This state helps track if a "Flip" has occurred during a drag operation.
   *
   * @returns `true` (Long), `false` (Short), or `null` (Uninitialized).
   */
  public getStoredDirection(): boolean | null {
    return this._isLong
  }

  /**
   * Updates the internally cached direction state.
   *
   * @param isLong - The new direction (`true` for Long).
   */
  public setStoredDirection(isLong: boolean): void {
    this._isLong = isLong
  }

  /**
   * Normalizes a raw price value to the nearest valid tick mark based on the instrument's precision.
   *
   * Precision rounding is used to ensure that internal calculations for Risk and Reward
   * distances do not accumulate floating-point noise. It includes a strict finiteness
   * check to prevent "NaN poisoning," where a corrupted price value could otherwise
   * cause the tool's geometry to collapse or disappear from the pane.
   *
   * @param price - The raw floating-point price to be normalized.
   * @returns The rounded price aligned with the current series minMove settings.
   * @private
   */
  private _roundPrice(price: number): number {
    const minMove = this._getMinMove()

    const cleanPrice = Number(price)
    if (!isFinite(cleanPrice)) {
      return 0
    }

    return Math.round(cleanPrice / minMove) * minMove
  }

  /**
   * Generates a logical Profit Target (P2) based on the standard 3:1 Risk/Reward ratio.
   *
   * This method measures the absolute price distance between the Entry (P0) and Stop Loss (P1)
   * to define the "Unit of Risk." It then projects three units of reward from the Entry
   * in the current trade direction.
   *
   * **Stability Fix:** Every input and intermediate result is wrapped in strict numeric
   * casting to ensure the Profit Target correctly maps to a 3R distance in Long mode,
   * bypassing the JavaScript "+" operator's tendency to concatenate strings.
   *
   * @param entryPoint - The logical Entry point (P0).
   * @param stopPoint - The logical Stop Loss point (P1).
   * @param ptPointTimestamp - The desired time coordinate for the target.
   * @returns A new logical point representing the calculated 3R Profit Target.
   */
  public calculateProfitTarget(
    entryPoint: LineToolPoint,
    stopPoint: LineToolPoint,
    ptPointTimestamp: number,
  ): LineToolPoint {
    const minMove = this._getMinMove()

    const entryPrice = this._roundPrice(Number(entryPoint?.price || 0))
    const stopPrice = this._roundPrice(Number(stopPoint?.price || 0))

    const riskDistance = Math.abs(entryPrice - stopPrice)
    const rewardDistance = riskDistance * 3

    // Direction check used for math only
    const isLong = entryPrice >= stopPrice

    let targetPtPrice: number
    if (isLong) {
      // Because minMove, entryPrice, and rewardDistance are all strictly Numbers,
      // the '+' operator will safely perform addition, never concatenation.
      targetPtPrice = entryPrice + rewardDistance
      targetPtPrice = Math.max(targetPtPrice, entryPrice + minMove)
    } else {
      targetPtPrice = entryPrice - rewardDistance
      targetPtPrice = Math.min(targetPtPrice, entryPrice - minMove)
    }

    return {
      price: this._roundPrice(targetPtPrice),
      timestamp: ptPointTimestamp,
    }
  }

  /**
   * Monitors the tool for a change in trade direction during an active user interaction.
   *
   * This acts as the state-machine gateway. If the user drags the Entry past the Stop
   * (or vice versa), this method detects the crossover and triggers the `_flipModeActive`
   * flag. This flag instructs the state machine to temporarily override the user's
   * custom Profit Target and reset the geometry to a perfect 3:1 ratio for the new direction.
   *
   * @param newEntryPrice - The updated price of the Entry anchor.
   * @param newStopPrice - The updated price of the Stop Loss anchor.
   * @returns `true` if a direction flip was detected and processed.
   * @private
   */
  private _checkForFlip(newEntryPrice: number, newStopPrice: number): boolean {
    // --- FIX: The Dead Zone / Sticky Logic ---
    // If prices are exactly equal, do not change direction.
    if (newEntryPrice === newStopPrice) return false

    const newIsLong = newEntryPrice > newStopPrice
    const flipOccurred = this._isLong !== null && this._isLong !== newIsLong
    this._isLong = newIsLong
    return flipOccurred
  }

  /**
   * The central orchestrator for the tool's internal business logic and geometric state.
   *
   * This method is executed after every drag or price update to ensure the tool
   * remains logically consistent. It coordinates:
   * 1. **Direction Synchronization:** Updates internal flags using Sticky Logic.
   * 2. **Temporal Alignment:** Ensures the Profit Target (P2) remains perfectly
   *    vertically aligned with the Stop Loss (P1) timestamp.
   * 3. **Ratio Management:** Switches between "Forced 3R Mode" (active during
   *    creation or immediately after a flip) and "Custom Mode" (where user-defined
   *    targets are respected but clamped).
   * 4. **Math Recovery:** Automatically detects and repairs `NaN` or infinite price
   *    states caused by previous string-math errors.
   *
   * @private
   */
  private _updateAndNormalizeToolState(): void {
    if (this._points.length < 2) return

    const minMove = this._getMinMove()

    const entryPrice = this._roundPrice(Number(this._points[0].price))
    const stopPrice = this._roundPrice(Number(this._points[1].price))

    // 1. Detect and Lock Flip
    if (this._checkForFlip(entryPrice, stopPrice)) {
      this._flipModeActive = true
    }

    if (this._points.length < 3) return

    // 2. Sync Timestamps
    const syncTime = this._points[1].timestamp
    this._points[2].timestamp = syncTime

    // 3. Math Logic
    if (this._clickCount < 2 || this._flipModeActive) {
      // Forced 3R Mode: Recalculate 3R based on current Entry/Stop
      const requiredPtPoint = this.calculateProfitTarget(this._points[0], this._points[1], syncTime)
      if (isFinite(requiredPtPoint.price)) {
        this._points[2].price = requiredPtPoint.price
      }
    } else {
      // Custom Mode: Maintain user distance but clamp to correct side of Entry
      const currentPtPrice = Number(this._points[2].price)
      const isLong = !!this._isLong

      // Safety fallback using the clean minMove
      let constrainedPtPrice = isFinite(currentPtPrice)
        ? currentPtPrice
        : isLong
          ? entryPrice + minMove * 10
          : entryPrice - minMove * 10

      if (isLong) {
        constrainedPtPrice = Math.max(constrainedPtPrice, entryPrice + minMove)
      } else {
        constrainedPtPrice = Math.min(constrainedPtPrice, entryPrice - minMove)
      }

      this._points[2].price = this._roundPrice(constrainedPtPrice)
    }
  }
  /**
   * Overrides the base method to inject a virtual Profit Target during creation.
   *
   * **Why override?**
   * During creation, the user only clicks P0 (Entry) and P1 (Stop). The P2 (Target) hasn't
   * been created yet. This override dynamically calculates where P2 *would* be (at 3R)
   * and returns it as part of the array. This allows the View to render the full Green/Red
   * shape while the user is still just dragging the Stop Loss ghost point.
   *
   * @returns The array of points, potentially including a virtual P2.
   * @override
   */
  public override points(): LineToolPoint[] {
    const corePoints = super.points() // [Entry] or [Entry, GhostStop]

    if (corePoints.length === 2) {
      // Calculate virtual PT
      const virtualPT = this.calculateProfitTarget(
        corePoints[0],
        corePoints[1],
        corePoints[1].timestamp,
      )
      return [...corePoints, virtualPT]
    }

    return corePoints
  }

  /**
   * Retrieves a point from the (potentially augmented) points array.
   *
   * Delegates to the overridden {@link points} method to ensure virtual points are returned correctly.
   *
   * @param index - The point index.
   * @returns The point or `null`.
   * @override
   */
  public override getPoint(index: number): LineToolPoint | null {
    // Use the overridden points() logic
    const allPoints = this.points()
    return allPoints[index] || null
  }

  /**
   * Updates the logical position of a specific anchor point and re-evaluates the tool state.
   *
   * This override intercepts raw user input from the Interaction Manager to apply
   * "Numeric Shielding" before the data reaches the model. It handles the distinct
   * logic required for dragging the Profit Target (which is price-constrained to its
   * own side of the Entry) versus dragging the Entry/Stop anchors (which can trigger
   * flips and recalculate the entire setup).
   *
   * @param index - The index of the anchor point (0: Entry, 1: Stop, 2: Target).
   * @param point - The new logical timestamp and price coordinates.
   * @override
   */
  public override setPoint(index: number, point: LineToolPoint): void {
    const newPrice = this._roundPrice(Number(point.price))
    const newTimestamp = point.timestamp

    if (index === 2 && this._points.length >= 3) {
      // --- PT DRAG ---
      const minMove = this._getMinMove()
      const entryPrice = Number(this._points[0].price)
      const isLong = this.isCurrentLong()

      let constrainedPrice = newPrice
      if (isLong) {
        constrainedPrice = Math.max(newPrice, entryPrice + minMove)
      } else {
        constrainedPrice = Math.min(newPrice, entryPrice - minMove)
      }

      this._points[2].price = this._roundPrice(constrainedPrice)
      this._points[2].timestamp = this._points[1].timestamp
    } else if (index < 2) {
      // --- ENTRY (0) or STOP (1) DRAG ---
      this._points[index].price = newPrice
      this._points[index].timestamp = newTimestamp

      // Re-run state machine
      this._updateAndNormalizeToolState()
    }
  }

  /**
   * Orchestrates the creation flow (Click 1 -> Entry, Click 2 -> Stop + Auto PT).
   *
   * **Tutorial Note:**
   * 1. **Click 1:** Adds Entry.
   * 2. **Click 2:** Adds Stop. Crucially, it **also** creates and pushes the permanent Profit Target (P2)
   *    calculated at 3R. It then immediately finalizes the tool (`tryFinish()`).
   *
   * @param point - The raw mouse point.
   * @override
   */
  public override addPoint(point: LineToolPoint): void {
    // PERFORMANCE: Use math rounding for the new point
    const series = this.getSeries()
    const minMove = series.options().priceFormat.minMove
    //point.price = Math.round(point.price / minMove) * minMove;
    point.price = this._roundPrice(point.price)

    if (this.isFinished()) return

    if (this._clickCount === 0) {
      // Click 1: Entry Point (P0)
      super.addPoint(point)
      this._clickCount = 1

      // --- FIX START: Initialize direction immediately ---
      this._isLong = true
      // --- FIX END ---
    } else if (this._clickCount === 1) {
      // Click 2: Finalize Stop Loss (P1)
      super.addPoint(point)
      this._clickCount = 2

      // Create and Add Permanent PT (P2)
      const p0 = this._points[0]
      const p1 = this._points[1]
      const p2 = this.calculateProfitTarget(p0, p1, p1.timestamp)
      this._points.push(p2)

      this._updateAndNormalizeToolState()
      this.tryFinish()
      this._coreApi.fireAfterEditEvent(this, 'lineToolFinished')
    }
  }

  /**
   * Legacy/No-op method.
   *
   * The core plugin handles ghosting via `setLastPoint`. This override exists to satisfy
   * internal contracts or legacy patterns but performs no action.
   */
  public updatePreviewPoints(point: LineToolPoint): void {
    // No-op: Core handles ghosting.
  }

  /**
   * Overrides the base ghost-point handler to enforce grid-snapping during
   * interactive creation.
   *
   * This method intercepts the high-precision logical price from the mouse
   * and immediately normalizes it to the nearest valid tick mark (minMove).
   * By "snapping" the input price before any calculations occur, we ensure
   * that the Risk/Reward ratio remains a stable, mathematically perfect
   * 3.00 while the user is dragging the Stop Loss ghost point.
   *
   * @param point - The raw logical timestamp and price from the mouse position.
   * @override
   */
  public override setLastPoint(point: LineToolPoint | null): void {
    if (point) {
      // Immediately round the mouse price to the instrument's tick size
      // This prevents high-precision floats from poisoning the 3R math
      point.price = this._roundPrice(point.price)
    }

    // Pass the sanitized point to the base implementation to trigger the redraw
    super.setLastPoint(point)
  }

  /**
   * Performs the hit test for the Position tool.
   *
   * **Architecture Note:**
   * Delegates to `LineToolLongShortPositionPaneView`. The view composites multiple renderers
   * (Risk Rect, Reward Rect, Labels). Hitting any of them selects the tool.
   *
   * @param x - X coordinate.
   * @param y - Y coordinate.
   * @returns A hit result, or `null`.
   * @override
   */
  public override _internalHitTest(x: Coordinate, y: Coordinate): HitTestResult<any> | null {
    // This guards against hitTest being called after the tool has been destroyed and _paneViews cleared.
    if (!this._paneViews || this._paneViews.length === 0 || !this._paneViews[0]) {
      return null
    }

    const paneView = this._paneViews[0] as LineToolLongShortPositionPaneView<HorzScaleItem>
    const compositeRenderer = paneView.renderer() as CompositeRenderer<HorzScaleItem>

    if (!compositeRenderer || !compositeRenderer.hitTest) {
      return null
    }
    return compositeRenderer.hitTest(x, y)
  }

  /**
   * Resets transient state flags at the end of an interaction (MouseUp).
   *
   * Specifically, it clears `_flipModeActive`, marking the end of a dynamic flip operation.
   * The geometric order of points is **not** sorted here because P0/P1/P2 have fixed roles
   * (Entry/Stop/Target) regardless of their price values.
   *
   * @override
   */
  public normalize(): void {
    this._flipModeActive = false
  }

  /**
   * Implements the Shift-key geometric constraint logic for precise price-level locking.
   *
   * When the user holds the Shift key while dragging the Entry or Stop Loss handles,
   * this method locks the vertical (price) movement to its original starting value.
   * This allows traders to adjust the "Timing" or horizontal duration of the trade
   * setup without the risk of accidentally altering the established price levels by
   * small pixel amounts.
   *
   * @param pointIndex - The index of the anchor handle being interacted with.
   * @param rawScreenPoint - The current raw pixel coordinates of the mouse.
   * @param phase - The current interaction state (Creation, Editing, or Move).
   * @param originalLogicalPoint - A static snapshot of the point's logical position at the moment of click.
   * @param allOriginalLogicalPoints - A static snapshot of the tool's entire point array.
   * @returns A result containing the constrained pixel coordinates and an axis-lock hint for the core.
   * @override
   */
  public override getShiftConstrainedPoint(
    pointIndex: number,
    rawScreenPoint: Point,
    phase: InteractionPhase,
    originalLogicalPoint: LineToolPoint,
    allOriginalLogicalPoints: LineToolPoint[],
  ): ConstraintResult {
    // Default behavior: No constraint
    const result: ConstraintResult = {
      point: rawScreenPoint,
      snapAxis: 'none',
    }

    // Only apply constraint during the Editing phase (dragging existing points),
    // not during Creation.
    if (phase !== InteractionPhase.Editing) {
      return result
    }

    // Apply constraint only to Entry (0) and Stop (1).
    // PT (2) is skipped because it is already strictly constrained to the Y-axis by setPoint logic.
    if (pointIndex === 0 || pointIndex === 1) {
      // Constraint: Lock Price (Horizontal movement only).
      // We calculate the screen Y coordinate of the *original* price to keep it locked.
      const series = this.getSeries()
      const lockedScreenY = series.priceToCoordinate(originalLogicalPoint.price)

      if (lockedScreenY !== null) {
        return {
          // Use mouse X, but lock Y to the original position
          point: new Point(rawScreenPoint.x, lockedScreenY as Coordinate),
          snapAxis: 'price', // Hint to the manager to preserve the exact original logical price
        }
      }
    }

    return result
  }

  /**
   * Calculates whether the tool's geometry is currently within the visible chart area.
   *
   * This method utilizes the Core's area-based culling logic to treat the combined
   * Risk and Reward rectangles as a single "Trade Zone."
   *
   * **Stability Fix:** It applies strict numeric shielding to all logical values
   * before evaluation. This prevents the "Alphabetical Comparison" bug where
   * decimal strings would fail geometric boundary tests, causing the tool to
   * flicker or disappear while scrolling or zooming.
   *
   * @protected
   * @override
   */
  protected override updateCullingState(): void {
    const points = this.points() // [P0, P1, P2]
    const options = this.options()

    if (points.length < this.pointsCount || this.isCreating() || this.isEditing()) {
      this._setIsCulled(false)
      return
    }

    // --- STABLE AREA CULLING START ---

    // 1. Identify absolute geometric extremes across ALL points.
    // This handles the 'Flip' scenario (Long vs Short) by ensuring
    // min is always the lowest value and max is always the highest.
    const minP = Math.min(points[0].price, points[1].price, points[2].price)
    const maxP = Math.max(points[0].price, points[1].price, points[2].price)

    // Note: Long/Short anchors share the same timestamp, but we use min/max
    // for architectural consistency.
    const minT = Math.min(points[0].timestamp, points[1].timestamp, points[2].timestamp)
    const maxT = Math.max(points[0].timestamp, points[1].timestamp, points[2].timestamp)

    // 2. Synthesize a guaranteed normalized Bounding Box
    const normalizedZonePoints: LineToolPoint[] = [
      { timestamp: minT, price: minP },
      // --- FIX: Ensure box has at least 1 logical unit of width to prevent culling errors ---
      { timestamp: maxT === minT ? maxT + 1 : maxT, price: maxP },
    ]

    const mergedExtend: ExtendOptions = {
      left: options.entryStopLossRectangle.extend.left || options.entryPtRectangle.extend.left,
      right: options.entryStopLossRectangle.extend.right || options.entryPtRectangle.extend.right,
    }

    // 3. Invoke the Core Culler
    // Passing the normalized points prevents the 'Long-mode' cull bug.
    const cullingState = getToolCullingState(
      normalizedZonePoints,
      this,
      mergedExtend,
      undefined,
      undefined,
      true, // isAreaBased
    )

    this._setIsCulled(cullingState !== OffScreenState.Visible)

    // --- STABLE AREA CULLING END ---
  }

  /**
   * Safely retrieves the minimum price movement (tick size) from the chart series.
   *
   * This helper acts as a critical "Numeric Shield" for the tool's math engine. By aggressively
   * casting the series price format settings into a primitive Number, it prevents
   * JavaScript's type-coercion engine from performing string concatenation (e.g., 100 + "0.25" = "1000.25")
   * instead of mathematical addition. This directly resolves the "Infinity Bug" encountered
   * in Long-mode Profit Target calculations.
   *
   * @returns The minimum price tick as a guaranteed finite Number.
   * @private
   */
  private _getMinMove(): number {
    const series = this.getSeries()
    const minMoveRaw = series.options().priceFormat.minMove
    const minMove = Number(minMoveRaw)

    // Fallback to 0.01 if the series returns something invalid or undefined
    return isFinite(minMove) && minMove > 0 ? minMove : 0.01
  }
}
