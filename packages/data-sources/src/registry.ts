import type { DataSourceProvider } from './types.js'

const providers = new Map<string, DataSourceProvider>()

export function registerDataSourceProvider(
  provider: DataSourceProvider,
): void {
  if (providers.has(provider.id)) {
    throw new Error(
      `Data source provider "${provider.id}" is already registered`,
    )
  }
  providers.set(provider.id, provider)
}

export function getDataSourceProvider(
  id: string,
): DataSourceProvider | undefined {
  return providers.get(id)
}

export function listDataSourceProviders(): DataSourceProvider[] {
  return Array.from(providers.values())
}
