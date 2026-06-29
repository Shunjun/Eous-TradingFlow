import { intervalToMs, subtractIntervals } from '@eous/data-sources'
import type { Kline } from '@eous/data-sources'
import {
  listPublishedWorkflowTriggerTargets,
  triggerPublishedWorkflow,
  type PublishedWorkflowTarget,
  type WorkflowNode,
} from './workflow-trigger.service.js'
import { setRedisOnce } from '../../lib/redis.js'
import {
  scanCandlestickPatterns,
  type SymbolPatternResult,
} from '../../services/pattern/candlestick-pattern-client.js'
import { marketDataService } from '../market-data/index.js'

type Direction = 'ANY' | 'BULLISH' | 'BEARISH'

interface CandlestickTriggerConfig {
  dataSourceInstanceId: string
  symbol: string
  interval: string
  patterns: string[]
  direction: Direction
  limit: number
}

interface CandlestickTriggerTarget extends PublishedWorkflowTarget {
  triggerNode: WorkflowNode
  config: CandlestickTriggerConfig
}

interface ScanTask {
  key: string
  userId: string
  dataSourceInstanceId: string
  symbol: string
  interval: string
  slotClose: number
  patterns: string[]
  limit: number
  targets: CandlestickTriggerTarget[]
}

const DEFAULT_LIMIT = 120
const MIN_LIMIT = 20
const MAX_LIMIT = 1000
const SCANNER_TICK_MS = 30_000
const localScanSlots = new Map<string, string>()
let scannerTimer: NodeJS.Timeout | null = null

function normalizePatternList(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  const patterns = raw
    .map((item) => String(item).trim().toUpperCase())
    .filter((item) => item.length > 0)
  return [...new Set(patterns)]
}

function normalizeDirection(value: unknown): Direction {
  return value === 'BULLISH' || value === 'BEARISH' || value === 'ANY' ? value : 'ANY'
}

function normalizeConfig(node: WorkflowNode): CandlestickTriggerConfig | null {
  const data = node.data
  const dataSourceInstanceId =
    typeof data.dataSourceInstanceId === 'string' ? data.dataSourceInstanceId.trim() : ''
  const symbol = typeof data.symbol === 'string' ? data.symbol.trim() : ''
  const interval = typeof data.interval === 'string' ? data.interval.trim() : ''
  const patterns = normalizePatternList(data.patterns)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(MIN_LIMIT, Math.floor(Number(data.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT)),
  )

  if (!dataSourceInstanceId || !symbol || !interval || patterns.length === 0) return null
  return {
    dataSourceInstanceId,
    symbol,
    interval,
    patterns,
    direction: normalizeDirection(data.direction),
    limit,
  }
}

function getLastClosedSlot(now: Date, interval: string): number | null {
  const intervalMs = intervalToMs(interval)
  if (!intervalMs) return null
  return Math.floor(now.getTime() / intervalMs) * intervalMs
}

function taskKey(params: {
  userId: string
  dataSourceInstanceId: string
  symbol: string
  interval: string
  slotClose: number
}): string {
  return [
    params.userId,
    params.dataSourceInstanceId,
    params.symbol,
    params.interval,
    String(params.slotClose),
  ].join(':')
}

function signalDirection(value: number): Exclude<Direction, 'ANY'> | null {
  if (value > 0) return 'BULLISH'
  if (value < 0) return 'BEARISH'
  return null
}

function matchesTarget(target: CandlestickTriggerTarget, result: SymbolPatternResult) {
  const configuredPatterns = new Set(target.config.patterns)
  return result.signals
    .filter((signal) => configuredPatterns.has(signal.pattern.toUpperCase()))
    .flatMap((signal) => {
      const direction = signalDirection(signal.value)
      if (!direction) return []
      if (target.config.direction !== 'ANY' && target.config.direction !== direction) return []
      return [
        {
          pattern: signal.pattern,
          value: signal.value,
          direction,
        },
      ]
    })
}

async function claimScanSlot(task: ScanTask): Promise<boolean> {
  const redisKey = `workflow:candlestick-scan:${task.key}`
  const claimed = await setRedisOnce(redisKey, 180)
  if (claimed !== null) return claimed

  if (localScanSlots.get(task.key) === task.key) return false
  localScanSlots.set(task.key, task.key)
  return true
}

async function fetchTaskKlines(task: ScanTask): Promise<Kline[]> {
  const from = subtractIntervals(task.slotClose, task.interval, task.limit)
  const klines = await marketDataService.getKlines({
    userId: task.userId,
    dataSourceInstanceId: task.dataSourceInstanceId,
    symbol: task.symbol,
    interval: task.interval,
    query: 'range',
    from,
    to: task.slotClose,
    limit: task.limit,
    mode: 'closed-only',
    priority: 'workflow',
  })
  return klines.filter((item) => item.timestamp < task.slotClose).slice(-task.limit)
}

async function listCandlestickTargets(): Promise<CandlestickTriggerTarget[]> {
  const targets = await listPublishedWorkflowTriggerTargets('trigger.candlestick-pattern')
  return targets.flatMap((target) => {
    const config = normalizeConfig(target.triggerNode)
    return config ? [{ ...target, config }] : []
  })
}

function buildTasks(targets: CandlestickTriggerTarget[], now: Date): ScanTask[] {
  const tasks = new Map<string, ScanTask>()

  for (const target of targets) {
    const slotClose = getLastClosedSlot(now, target.config.interval)
    if (!slotClose) continue

    const key = taskKey({
      userId: target.workflow.userId,
      dataSourceInstanceId: target.config.dataSourceInstanceId,
      symbol: target.config.symbol,
      interval: target.config.interval,
      slotClose,
    })
    const existing = tasks.get(key)
    if (existing) {
      existing.targets.push(target)
      existing.limit = Math.max(existing.limit, target.config.limit)
      for (const pattern of target.config.patterns) {
        if (!existing.patterns.includes(pattern)) existing.patterns.push(pattern)
      }
      continue
    }

    tasks.set(key, {
      key,
      userId: target.workflow.userId,
      dataSourceInstanceId: target.config.dataSourceInstanceId,
      symbol: target.config.symbol,
      interval: target.config.interval,
      slotClose,
      patterns: [...target.config.patterns],
      limit: target.config.limit,
      targets: [target],
    })
  }

  return [...tasks.values()]
}

async function processTask(task: ScanTask, now: Date) {
  const klines = await fetchTaskKlines(task)
  if (klines.length === 0) return

  const claimed = await claimScanSlot(task)
  if (!claimed) return

  const results = await scanCandlestickPatterns({
    timeframe: task.interval,
    patterns: task.patterns,
    symbols: [
      {
        symbol: task.symbol,
        klines: klines.map((item) => ({
          timestamp: item.timestamp,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close,
          volume: item.volume ?? 0,
        })),
      },
    ],
  })

  const result = results.find((item) => item.symbol === task.symbol)
  if (!result) return

  const allSignals = Object.fromEntries(
    result.signals.map((signal) => [signal.pattern, signal.value]),
  )
  const kline = klines.find((item) => item.timestamp === result.signalTime) ?? klines.at(-1) ?? null

  for (const target of task.targets) {
    const matchedSignals = matchesTarget(target, result)
    if (matchedSignals.length === 0) continue

    void triggerPublishedWorkflow({
      workflow: target.workflow,
      definition: target.definition,
      triggerNodeId: target.triggerNode.id,
      triggerKind: 'market-pattern',
      input: {
        candlestickPattern: {
          dataSourceInstanceId: task.dataSourceInstanceId,
          symbol: task.symbol,
          interval: task.interval,
          kline: kline ? { ...kline, volume: kline.volume ?? 0 } : null,
          matchedSignals,
          allSignals,
          scanTime: now.toISOString(),
        },
      },
    }).catch((error) => {
      console.error(
        `[candlestick-trigger] failed workflow=${target.workflow.id} node=${target.triggerNode.id}`,
        error,
      )
    })
  }
}

export async function candlestickPatternScannerTick(now = new Date()) {
  const targets = await listCandlestickTargets()
  const tasks = buildTasks(targets, now)

  for (const task of tasks) {
    try {
      await processTask(task, now)
    } catch (error) {
      console.error(
        `[candlestick-trigger] scan failed source=${task.dataSourceInstanceId} symbol=${task.symbol} interval=${task.interval}`,
        error,
      )
    }
  }
}

export function startCandlestickPatternScanner() {
  if (scannerTimer) return
  scannerTimer = setInterval(() => {
    void candlestickPatternScannerTick()
  }, SCANNER_TICK_MS)
  scannerTimer.unref?.()
  void candlestickPatternScannerTick()
}
