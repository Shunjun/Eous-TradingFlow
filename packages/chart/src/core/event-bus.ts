import type { ChartTheme } from '../types'
import type { KlineDataPoint } from './kline-data'

// ── Event Types ──────────────────────────────────────────────────────────────

export interface ChartEvents {
  'data:updated': { klines: KlineDataPoint[]; fit: boolean }
  'theme:changed': { theme: ChartTheme }
}

type EventKey = keyof ChartEvents
type Handler<T> = (payload: T) => void

// ── EventBus ─────────────────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<EventKey, Set<Handler<unknown>>>()

  on<K extends EventKey>(event: K, handler: Handler<ChartEvents[K]>): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(handler as Handler<unknown>)

    return () => {
      set!.delete(handler as Handler<unknown>)
    }
  }

  emit<K extends EventKey>(event: K, payload: ChartEvents[K]): void {
    const set = this.listeners.get(event)
    if (!set) return
    for (const handler of set) {
      handler(payload)
    }
  }

  destroy(): void {
    this.listeners.clear()
  }
}
