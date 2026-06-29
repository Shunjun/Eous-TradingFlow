import { useMemo } from 'react'
import type {
  FetchKlinesFn,
  GetIntervalsFn,
  GetProvidersFn,
  GetSymbolsFn,
  KlineDataPoint,
} from '@eous/chart'
import type { DataSourceInstance, SymbolSearchResult } from '@eous/api-client'
import { api, marketData } from '../../../lib/api.js'

const PAGE_SIZE = 50

export function useKlineData() {
  const getProviders = useMemo<GetProvidersFn>(() => {
    return async () => {
      const d = await api.listDataSourceInstances()
      return d.instances.map((inst: DataSourceInstance) => ({
        id: inst.id,
        name: inst.name,
        defaultSymbol: inst.defaultSymbol,
      }))
    }
  }, [])

  const getIntervals = useMemo<GetIntervalsFn>(() => {
    return async (providerId: string, intervals: string[]) => {
      const d = await api.getDataSourceInstanceIntervalSupport(providerId, intervals)
      return d.intervals.map((item) => ({
        label: item.interval,
        value: item.interval,
        supported: item.supported,
        mode: item.mode,
        baseInterval: item.baseInterval,
        reason: item.reason,
      }))
    }
  }, [])

  const getSymbols = useMemo<GetSymbolsFn>(() => {
    return async ({ providerId, query, offset = 0, limit = PAGE_SIZE }) => {
      const data = await api.getDataSourceInstanceSymbols(providerId, query?.trim())
      return {
        items: data.symbols.map((r: SymbolSearchResult) => ({
          symbol: r.symbol,
          name: r.name,
          exchange: r.exchange,
          type: r.type,
          providerId,
        })),
        total: data.total,
      }
    }
  }, [])

  const fetchKlines = useMemo<FetchKlinesFn>(() => {
    return async ({ symbol, interval, query, from, to, before, limit, providerId }) => {
      if (!providerId) return []
      const body: Record<string, unknown> = { symbol, interval }
      if (query !== undefined) body.query = query
      if (from !== undefined) body.from = from
      if (to !== undefined) body.to = to
      if (before !== undefined) body.before = before
      if (limit !== undefined) body.limit = limit
      if (!query && from === undefined && to === undefined && before === undefined) {
        body.mode = 'closed-only'
      }
      const data = await api.getDataSourceKlines(
        providerId,
        body as {
          symbol: string
          interval: string
          query?: 'latest' | 'before' | 'range'
          from?: number
          to?: number
          before?: number
          limit?: number
          mode?: 'closed-only' | 'include-live'
        },
      )
      return data.klines as KlineDataPoint[]
    }
  }, [])

  const getDrawings = useMemo(() => {
    return async ({ providerId, symbol }: { providerId: string; symbol: string }) => {
      const data = await api.getDataSourceDrawings(providerId, symbol)
      return data.drawing.payload
    }
  }, [])

  const saveDrawings = useMemo(() => {
    return async ({
      providerId,
      drawings,
    }: {
      providerId: string
      drawings: { symbol: string; payload: string }[]
    }) => {
      await api.saveDataSourceDrawings(providerId, { drawings })
    }
  }, [])

  const getChartConfig = useMemo(() => {
    return async () => {
      const data = await api.getChartConfig()
      return data.config
    }
  }, [])

  const saveChartConfig = useMemo(() => {
    return async (config: Parameters<typeof api.updateChartConfig>[0]) => {
      await api.updateChartConfig(config)
    }
  }, [])

  return {
    getProviders,
    getIntervals,
    getSymbols,
    fetchKlines,
    subscribeKlineUpdates: marketData.subscribeKlineUpdates,
    getDrawings,
    saveDrawings,
    getChartConfig,
    saveChartConfig,
  }
}
