import { useCallback, useState } from 'react'
import type { KlineChartProps } from '@eous/chart'
import type { ViewStateBridge } from '../types.js'

export interface KlineViewState {
  symbol: string | null
  providerId: string | null
  interval: string
}

export type KlineViewProps = Pick<
  KlineChartProps,
  | 'defaultSymbol'
  | 'defaultProviderId'
  | 'defaultInterval'
  | 'onSymbolChange'
  | 'onProviderChange'
  | 'onIntervalChange'
>

const DEFAULT_KLINE_STATE: KlineViewState = {
  symbol: null,
  providerId: null,
  interval: '1d',
}

export function createDefaultKlineViewState(): KlineViewState {
  return { ...DEFAULT_KLINE_STATE }
}

export function normalizeKlineViewState(raw: unknown): KlineViewState {
  const value = raw as Partial<KlineViewState> | null | undefined
  return {
    symbol: typeof value?.symbol === 'string' ? value.symbol : null,
    providerId: typeof value?.providerId === 'string' ? value.providerId : null,
    interval: typeof value?.interval === 'string' ? value.interval : DEFAULT_KLINE_STATE.interval,
  }
}

export function getKlineViewTitle(state: KlineViewState) {
  return state.symbol ? `K Line · ${state.symbol}` : 'K Line'
}

export function useKlineViewState(
  initialState: unknown,
  onChange: (state: KlineViewState) => void,
): ViewStateBridge<KlineViewState, KlineViewProps> {
  const [state, setState] = useState<KlineViewState>(() => normalizeKlineViewState(initialState))

  const updateState = useCallback(
    (next: Partial<KlineViewState>) => {
      setState((prev) => {
        const updated = { ...prev, ...next }
        onChange(updated)
        return updated
      })
    },
    [onChange],
  )

  return {
    state,
    title: getKlineViewTitle(state),
    props: {
      defaultSymbol: state.symbol ?? undefined,
      defaultProviderId: state.providerId ?? undefined,
      defaultInterval: state.interval,
      onSymbolChange: (symbol) => updateState({ symbol }),
      onProviderChange: (providerId) => updateState({ providerId }),
      onIntervalChange: (interval) => updateState({ interval }),
    },
  }
}
