import { useMemo } from 'react'
import type {
  FetchKlinesFn,
  GetIntervalsFn,
  GetProvidersFn,
  GetSymbolsFn,
  IntervalOption,
  KlineDataPoint,
} from '@eous/chart'
import type { DataSourceInstance, SymbolSearchResult } from '@eous/types'
import { api } from '../../../lib/api.js'

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
    return async (providerId: string) => {
      const d = await api.getDataSourceInstanceIntervals(providerId)
      return d.intervals as IntervalOption[]
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
    return async ({ symbol, interval, from, to, providerId }) => {
      if (!providerId) return []
      const body: Record<string, unknown> = { symbol, interval }
      if (from !== undefined) body.from = from
      if (to !== undefined) body.to = to
      const data = await api.getDataSourceKlines(
        providerId,
        body as { symbol: string; interval: string; from?: number; to?: number },
      )
      return data.klines as KlineDataPoint[]
    }
  }, [])

  return { getProviders, getIntervals, getSymbols, fetchKlines }
}
