import type { DataSourceProvider } from './types.js'

const providers = new Map<string, DataSourceProvider<any>>()

export function registerDataSourceProvider(provider: DataSourceProvider<any>): void {
  if (providers.has(provider.id)) {
    throw new Error(`Data source provider "${provider.id}" is already registered`)
  }
  providers.set(provider.id, provider)
}

export function getDataSourceProvider(id: string): DataSourceProvider<any> | undefined {
  return providers.get(id)
}

export function listDataSourceProviders(): DataSourceProvider<any>[] {
  return Array.from(providers.values())
}
