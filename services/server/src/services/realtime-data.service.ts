import {
  aggregateKlines,
  canonicalizeInterval,
  intervalToMs,
  resolveIntervalSupport,
  type DataSourceSettings,
  type DataSourceProvider,
  type IntervalSupport,
  type Kline,
  type Quote,
  type RealtimeCapabilities,
  type RealtimeKlineEvent,
  type RealtimeMode,
  type RealtimeQuoteEvent,
  type RealtimeSubscribeMode,
  type RealtimeUnsubscribe,
} from '@eous/data-sources'
import { AppError } from '../lib/app-error.js'
import { parseIntervalMs } from '../lib/interval-utils.js'
import * as dsRepo from '../repositories/data-source.repo.js'
import {
  DEFAULT_REALTIME_CAPABILITIES,
  DEFAULT_REALTIME_POLL_INTERVAL_MS,
  decryptInstance,
} from './data-source.service.js'

export type RealtimeChannel = 'quote' | 'kline'

export interface RealtimeSubscribeMessage {
  type: 'subscribe'
  requestId?: string
  channel: RealtimeChannel
  providerId: string
  symbol: string
  interval?: string
  mode?: RealtimeSubscribeMode
  pollIntervalMs?: number
}

export interface RealtimeUnsubscribeMessage {
  type: 'unsubscribe'
  requestId?: string
  subscriptionId: string
}

export type RealtimeClientMessage = RealtimeSubscribeMessage | RealtimeUnsubscribeMessage

export type RealtimeServerEvent =
  | (RealtimeQuoteEvent & {
      providerId: string
      subscriptionId: string
    })
  | (RealtimeKlineEvent & {
      providerId: string
      subscriptionId: string
    })

export interface RealtimeSubscribedMessage {
  type: 'subscribed'
  requestId?: string
  subscriptionId: string
  channel: RealtimeChannel
  providerId: string
  symbol: string
  interval?: string
  source: RealtimeMode
  pollIntervalMs?: number
}

export interface RealtimeUnsubscribedMessage {
  type: 'unsubscribed'
  requestId?: string
  subscriptionId: string
}

export interface RealtimeErrorMessage {
  type: 'error'
  requestId?: string
  subscriptionId?: string
  error: string
}

export type RealtimeServerMessage =
  | RealtimeServerEvent
  | RealtimeSubscribedMessage
  | RealtimeUnsubscribedMessage
  | RealtimeErrorMessage
  | { type: 'pong'; timestamp: number }

type Emit = (message: RealtimeServerEvent) => void

interface ResolvedProvider {
  settings: DataSourceSettings
  provider: DataSourceProvider<DataSourceSettings>
}

interface ResolvedIntervalSupport {
  requestedInterval: string
  support: IntervalSupport
}

interface UpstreamTask {
  key: string
  providerId: string
  channel: RealtimeChannel
  symbol: string
  interval?: string
  source: RealtimeMode
  pollIntervalMs?: number
  listeners: Map<string, Emit>
  stop: RealtimeUnsubscribe
}

export interface RealtimeSubscription {
  subscriptionId: string
  channel: RealtimeChannel
  providerId: string
  symbol: string
  interval?: string
  source: RealtimeMode
  pollIntervalMs?: number
}

const MIN_SAFE_POLL_INTERVAL_MS = 1_000

function mergeCapabilities(capabilities?: RealtimeCapabilities): RealtimeCapabilities {
  return {
    quote: {
      ...DEFAULT_REALTIME_CAPABILITIES.quote,
      ...capabilities?.quote,
    },
    kline: {
      ...DEFAULT_REALTIME_CAPABILITIES.kline,
      ...capabilities?.kline,
    },
  }
}

function normalizePollInterval(requested: number | undefined, minimum: number | undefined): number {
  const requestedMs =
    typeof requested === 'number' && Number.isFinite(requested) ? requested : undefined
  return Math.max(
    requestedMs ?? DEFAULT_REALTIME_POLL_INTERVAL_MS,
    minimum ?? DEFAULT_REALTIME_POLL_INTERVAL_MS,
    MIN_SAFE_POLL_INTERVAL_MS,
  )
}

function chooseMode(
  requested: RealtimeSubscribeMode | undefined,
  modes: RealtimeMode[],
  hasStreamImplementation: boolean,
): RealtimeMode {
  const mode = requested ?? 'auto'
  const supportsStream = modes.includes('stream') && hasStreamImplementation
  const supportsPoll = modes.includes('poll')

  if (mode === 'stream') {
    if (!supportsStream)
      throw new AppError('Realtime stream is not supported for this channel', 400)
    return 'stream'
  }

  if (mode === 'poll') {
    if (!supportsPoll) throw new AppError('Realtime polling is not supported for this channel', 400)
    return 'poll'
  }

  if (supportsStream) return 'stream'
  if (supportsPoll) return 'poll'
  throw new AppError('No realtime mode is supported for this channel', 400)
}

function quoteSignature(quote: Quote): string {
  return JSON.stringify([
    quote.symbol,
    quote.price,
    quote.change,
    quote.changePercent,
    quote.high,
    quote.low,
    quote.open,
    quote.volume,
    quote.timestamp,
  ])
}

function klineSignature(kline: Kline): string {
  return JSON.stringify([
    kline.timestamp,
    kline.open,
    kline.high,
    kline.low,
    kline.close,
    kline.volume,
  ])
}

function latestKline(klines: Kline[]): Kline | null {
  if (klines.length === 0) return null
  return klines.reduce((latest, item) => (item.timestamp > latest.timestamp ? item : latest))
}

function makeSubscriptionId(): string {
  return `rt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export class RealtimeDataService {
  private readonly upstreams = new Map<string, UpstreamTask>()
  private readonly subscriptionToUpstream = new Map<string, string>()

  async subscribe(
    userId: string,
    message: RealtimeSubscribeMessage,
    emit: Emit,
  ): Promise<RealtimeSubscription> {
    if (!message.providerId || !message.symbol) {
      throw new AppError('Missing required realtime subscription fields', 400)
    }
    if (message.channel === 'kline' && !message.interval) {
      throw new AppError('Missing required field for kline subscription: interval', 400)
    }

    const resolved = await this.resolveProvider(userId, message.providerId)
    const capabilities = mergeCapabilities(
      resolved.provider.getRealtimeCapabilities
        ? await resolved.provider.getRealtimeCapabilities(resolved.settings)
        : undefined,
    )

    const channelCapabilities = capabilities[message.channel]
    let intervalSupport: ResolvedIntervalSupport | undefined
    if (message.channel === 'kline') {
      intervalSupport = await this.resolveIntervalSupport(resolved, message.interval!)
      if (!intervalSupport.support.supported) {
        throw new AppError(
          `Realtime kline interval is not supported: ${intervalSupport.support.reason ?? message.interval}`,
          400,
        )
      }
    }

    let source = chooseMode(
      message.mode,
      intervalSupport?.support.mode === 'derived'
        ? channelCapabilities.modes.filter((mode) => mode === 'poll')
        : channelCapabilities.modes,
      message.channel === 'quote'
        ? typeof resolved.provider.subscribeQuote === 'function'
        : typeof resolved.provider.subscribeKlines === 'function',
    )
    let pollIntervalMs =
      source === 'poll'
        ? normalizePollInterval(message.pollIntervalMs, channelCapabilities.minPollIntervalMs)
        : undefined
    let key = this.getUpstreamKey(userId, message, source, pollIntervalMs)
    let upstream = this.upstreams.get(key)
    if (!upstream) {
      try {
        upstream = await this.startUpstream({
          key,
          message,
          intervalSupport,
          source,
          pollIntervalMs,
          resolved,
        })
      } catch (e) {
        const canFallbackToPoll =
          (message.mode == null || message.mode === 'auto') &&
          source === 'stream' &&
          channelCapabilities.modes.includes('poll')
        if (!canFallbackToPoll) throw e

        console.warn('[realtime] stream unavailable, falling back to poll', {
          providerId: message.providerId,
          channel: message.channel,
          symbol: message.symbol,
          interval: message.interval,
          error: e instanceof Error ? e.message : String(e),
        })

        source = 'poll'
        pollIntervalMs = normalizePollInterval(
          message.pollIntervalMs,
          channelCapabilities.minPollIntervalMs,
        )
        key = this.getUpstreamKey(userId, message, source, pollIntervalMs)
        upstream = this.upstreams.get(key)
        if (!upstream) {
          upstream = await this.startUpstream({
            key,
            message,
            intervalSupport,
            source,
            pollIntervalMs,
            resolved,
          })
        }
      }
      this.upstreams.set(key, upstream)
    }

    const subscriptionId = makeSubscriptionId()
    upstream.listeners.set(subscriptionId, emit)
    this.subscriptionToUpstream.set(subscriptionId, key)

    return {
      subscriptionId,
      channel: message.channel,
      providerId: message.providerId,
      symbol: message.symbol,
      interval: message.interval,
      source,
      pollIntervalMs,
    }
  }

  async unsubscribe(subscriptionId: string): Promise<boolean> {
    const key = this.subscriptionToUpstream.get(subscriptionId)
    if (!key) return false

    this.subscriptionToUpstream.delete(subscriptionId)
    const upstream = this.upstreams.get(key)
    if (!upstream) return false

    upstream.listeners.delete(subscriptionId)
    if (upstream.listeners.size === 0) {
      this.upstreams.delete(key)
      await upstream.stop()
    }
    return true
  }

  async unsubscribeAll(subscriptionIds: Iterable<string>): Promise<void> {
    await Promise.all(
      Array.from(subscriptionIds, (subscriptionId) => this.unsubscribe(subscriptionId)),
    )
  }

  private async resolveProvider(userId: string, providerId: string): Promise<ResolvedProvider> {
    const instance = await dsRepo.findByIdAndUser(providerId, userId)
    if (!instance) {
      throw new AppError('Instance not found', 404)
    }

    const { config: settings, provider } = await decryptInstance(instance)
    return { settings, provider: provider as DataSourceProvider<DataSourceSettings> }
  }

  private async startUpstream(params: {
    key: string
    message: RealtimeSubscribeMessage
    intervalSupport?: ResolvedIntervalSupport
    source: RealtimeMode
    pollIntervalMs?: number
    resolved: ResolvedProvider
  }): Promise<UpstreamTask> {
    const { key, message, intervalSupport, source, pollIntervalMs, resolved } = params
    const listeners = new Map<string, Emit>()
    const emitToListeners = (event: RealtimeQuoteEvent | RealtimeKlineEvent) => {
      for (const [subscriptionId, listener] of listeners) {
        listener({
          ...event,
          providerId: message.providerId,
          subscriptionId,
        })
      }
    }

    const stop =
      source === 'stream'
        ? await this.startStream(message, resolved, emitToListeners)
        : this.startPoll(message, intervalSupport, pollIntervalMs!, resolved, emitToListeners)

    return {
      key,
      providerId: message.providerId,
      channel: message.channel,
      symbol: message.symbol,
      interval: message.interval,
      source,
      pollIntervalMs,
      listeners,
      stop,
    }
  }

  private async startStream(
    message: RealtimeSubscribeMessage,
    resolved: ResolvedProvider,
    emit: (event: RealtimeQuoteEvent | RealtimeKlineEvent) => void,
  ): Promise<RealtimeUnsubscribe> {
    if (message.channel === 'quote') {
      if (!resolved.provider.subscribeQuote) {
        throw new AppError('Realtime quote stream is not implemented by provider', 400)
      }
      return resolved.provider.subscribeQuote(
        { symbol: message.symbol, mode: 'stream', pollIntervalMs: message.pollIntervalMs },
        resolved.settings,
        emit,
      )
    }

    if (!resolved.provider.subscribeKlines) {
      throw new AppError('Realtime kline stream is not implemented by provider', 400)
    }
    return resolved.provider.subscribeKlines(
      {
        symbol: message.symbol,
        interval: message.interval!,
        mode: 'stream',
        pollIntervalMs: message.pollIntervalMs,
      },
      resolved.settings,
      emit,
    )
  }

  private startPoll(
    message: RealtimeSubscribeMessage,
    intervalSupport: ResolvedIntervalSupport | undefined,
    pollIntervalMs: number,
    resolved: ResolvedProvider,
    emit: (event: RealtimeQuoteEvent | RealtimeKlineEvent) => void,
  ): RealtimeUnsubscribe {
    let lastSignature: string | null = null
    let inFlight = false
    let stopped = false

    const tick = async () => {
      if (inFlight || stopped) return
      inFlight = true
      try {
        if (message.channel === 'quote') {
          const quote = await resolved.provider.getQuote(message.symbol, resolved.settings)
          const signature = quoteSignature(quote)
          if (signature !== lastSignature) {
            lastSignature = signature
            emit({
              type: 'quote',
              symbol: message.symbol,
              data: quote,
              source: 'poll',
              timestamp: Date.now(),
            })
          }
          return
        }

        const requestedInterval = intervalSupport?.support.interval ?? message.interval!
        const requestInterval =
          intervalSupport?.support.mode === 'derived'
            ? intervalSupport.support.baseInterval!
            : requestedInterval
        const intervalMs = intervalToMs(requestedInterval) ?? parseIntervalMs(requestedInterval)
        const requestIntervalMs = intervalToMs(requestInterval) ?? parseIntervalMs(requestInterval)
        const now = Date.now()
        const sourceKlines = await resolved.provider.getKlines(
          {
            symbol: message.symbol,
            interval: requestInterval,
            from: now - Math.max(intervalMs * 3, requestIntervalMs * 6, pollIntervalMs),
            to: now,
          },
          resolved.settings,
        )
        const klines =
          intervalSupport?.support.mode === 'derived'
            ? aggregateKlines(sourceKlines, requestedInterval, intervalSupport.support.aggregation)
            : sourceKlines
        const kline = latestKline(klines)
        if (!kline) return

        const signature = klineSignature(kline)
        if (signature !== lastSignature) {
          lastSignature = signature
          emit({
            type: 'kline',
            symbol: message.symbol,
            interval: requestedInterval,
            data: kline,
            isFinal: kline.timestamp + intervalMs <= now,
            source: 'poll',
            timestamp: Date.now(),
          })
        }
      } catch (e) {
        console.error('[realtime poll] failed', {
          providerId: message.providerId,
          channel: message.channel,
          symbol: message.symbol,
          interval: message.interval,
          error: e instanceof Error ? e.message : String(e),
        })
      } finally {
        inFlight = false
      }
    }

    void tick()
    const timer = setInterval(() => void tick(), pollIntervalMs)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }

  private getUpstreamKey(
    userId: string,
    message: RealtimeSubscribeMessage,
    source: RealtimeMode,
    pollIntervalMs: number | undefined,
  ): string {
    return [
      userId,
      message.providerId,
      message.channel,
      message.symbol,
      message.interval ?? '',
      source,
      pollIntervalMs ?? '',
    ].join(':')
  }

  private async resolveIntervalSupport(
    resolved: ResolvedProvider,
    interval: string,
  ): Promise<ResolvedIntervalSupport> {
    const normalized = canonicalizeInterval(interval)
    if (!normalized) {
      return {
        requestedInterval: interval,
        support: {
          requestedInterval: interval,
          interval,
          supported: false,
          reason: 'Invalid interval format',
        },
      }
    }

    const supports = resolved.provider.getIntervalSupport
      ? await resolved.provider.getIntervalSupport({ intervals: [normalized] }, resolved.settings)
      : resolveIntervalSupport({
          requestedIntervals: [normalized],
          nativeIntervals: resolved.provider.getSupportedIntervals
            ? (await resolved.provider.getSupportedIntervals(resolved.settings)).map(
                (item) => item.value,
              )
            : [],
        })

    return {
      requestedInterval: interval,
      support: supports[0] ?? {
        requestedInterval: interval,
        interval: normalized,
        supported: false,
        reason: 'Provider did not return interval support',
      },
    }
  }
}

export const realtimeDataService = new RealtimeDataService()
