import { useEffect, useState } from 'react'
import type { ParamDef } from '@eous/nodes'
import { api } from '../../../../lib/api'

interface SelectOption {
  label: string
  value: string
}

function sameOptions(prev: SelectOption[], next: SelectOption[]) {
  return (
    prev.length === next.length && prev.every((item, index) => item.value === next[index].value)
  )
}

function useOptionsSource(
  optionsSource: ParamDef['optionsSource'],
  data: Record<string, unknown>,
  query?: string,
): { options: SelectOption[]; loading: boolean } {
  const [options, setOptions] = useState<SelectOption[]>([])
  const [loading, setLoading] = useState(false)

  const instanceId =
    typeof data.dataSourceInstanceId === 'string' ? data.dataSourceInstanceId : null
  const providerModelProviderId =
    optionsSource?.source === 'providerModels' &&
    typeof data[optionsSource.providerIdField] === 'string'
      ? (data[optionsSource.providerIdField] as string)
      : null

  useEffect(() => {
    if (!optionsSource) return

    let cancelled = false
    const source = optionsSource

    async function load() {
      setLoading(true)
      try {
        let next: SelectOption[] = []

        if (source.source === 'dataSourceInstances') {
          const res = await api.listDataSourceInstances()
          next = res.instances.map((instance) => ({
            label: `${instance.name} (${instance.providerKind})`,
            value: instance.id,
          }))
        } else if (source.source === 'instanceSymbols') {
          if (instanceId) {
            const res = await api.getDataSourceInstanceSymbols(instanceId, query)
            next = res.symbols.map((symbol) => ({
              label: symbol.name ? `${symbol.symbol} — ${symbol.name}` : symbol.symbol,
              value: symbol.symbol,
            }))
          }
        } else if (source.source === 'instanceIntervals') {
          if (instanceId) {
            const res = await api.getDataSourceInstanceIntervals(instanceId)
            next = res.intervals.map((interval) => ({
              label: interval.label,
              value: interval.value,
            }))
          }
        } else if (source.source === 'providers') {
          const res = await api.listProviders()
          next = (res.providers ?? []).map(
            (provider: { id: string; name: string; kind: string }) => ({
              label: `${provider.name} (${provider.kind})`,
              value: provider.id,
            }),
          )
        } else if (source.source === 'agents') {
          const res = await api.listAgents()
          next = (res.agents ?? []).map(
            (agent: { id: string; name: string; modelId?: string | null }) => ({
              label: agent.modelId ? `${agent.name} (${agent.modelId})` : agent.name,
              value: agent.id,
            }),
          )
        } else if (source.source === 'providerModels' && providerModelProviderId) {
          const res = await api.getProvider(providerModelProviderId)
          next = (res.models ?? []).map(
            (model: { modelId: string; displayName?: string | null }) => ({
              label: model.displayName ?? model.modelId,
              value: model.modelId,
            }),
          )
        }

        if (!cancelled) {
          setOptions((prev) => (sameOptions(prev, next) ? prev : next))
        }
      } catch {
        if (!cancelled) setOptions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [optionsSource, instanceId, providerModelProviderId, query])

  return { options, loading }
}

export { useOptionsSource }
export type { SelectOption }
