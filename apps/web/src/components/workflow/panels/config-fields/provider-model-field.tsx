import { useEffect, useMemo, useState } from 'react'
import type { Provider, ProviderModel } from '@eous/api-client'
import type { ParamDef } from '@eous/nodes'
import { api } from '../../../../lib/api'

interface ProviderModelFieldProps {
  param: ParamDef
  data: Record<string, unknown>
  onChange: (patch: Record<string, unknown>) => void
}

function ProviderModelField({ param, data, onChange }: ProviderModelFieldProps) {
  const [providers, setProviders] = useState<Provider[]>([])
  const [modelsByProviderId, setModelsByProviderId] = useState<Record<string, ProviderModel[]>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const providerRes = await api.listProviders()
        const modelEntries = await Promise.all(
          providerRes.providers.map(async (provider) => {
            try {
              const res = await api.getProvider(provider.id)
              return [provider.id, res.models.filter((model) => model.enabled)] as const
            } catch {
              return [provider.id, []] as const
            }
          }),
        )

        if (!cancelled) {
          setProviders(providerRes.providers)
          setModelsByProviderId(Object.fromEntries(modelEntries))
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedProviderId = typeof data.providerId === 'string' ? data.providerId : ''
  const selectedModelId = typeof data.modelId === 'string' ? data.modelId : ''
  const selectedValue =
    selectedProviderId && selectedModelId ? `${selectedProviderId}::${selectedModelId}` : ''

  const hasModels = useMemo(
    () => providers.some((provider) => (modelsByProviderId[provider.id] ?? []).length > 0),
    [modelsByProviderId, providers],
  )

  return (
    <select
      className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
      value={selectedValue}
      disabled={loading || !hasModels}
      onChange={(event) => {
        const value = event.target.value
        if (!value) {
          onChange({ providerId: '', modelId: '' })
          return
        }
        const [providerId, modelId] = value.split('::')
        onChange({ providerId, modelId })
      }}
    >
      <option value="">
        {loading
          ? '加载模型中...'
          : hasModels
            ? (param.placeholder ?? '请选择模型...')
            : '暂无可用模型'}
      </option>
      {providers.map((provider) => {
        const models = modelsByProviderId[provider.id] ?? []
        if (models.length === 0) return null

        return (
          <optgroup key={provider.id} label={provider.name}>
            {models.map((model) => (
              <option key={model.id} value={`${provider.id}::${model.modelId}`}>
                {model.displayName ?? model.modelId}
              </option>
            ))}
          </optgroup>
        )
      })}
    </select>
  )
}

export { ProviderModelField }
