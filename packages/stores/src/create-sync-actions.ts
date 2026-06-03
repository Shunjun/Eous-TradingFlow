export interface SyncActionsConfig<TState, TRaw = unknown> {
  endpoint: string
  serialize: (state: TState) => TRaw
  deserialize?: (raw: TRaw) => Partial<TState>
  debounceMs?: number
  fetchOptions?: RequestInit
}

export interface SyncActions {
  loaded: boolean
  dirty: boolean
  load: () => Promise<void>
  save: () => Promise<void>
  markDirty: () => void
  cleanup: () => void
}

export function createSyncActions<TState extends SyncActions, TRaw = unknown>(
  set:
    | ((partial: Partial<TState>, replace?: false) => void)
    | ((partial: Partial<TState>, replace?: true) => void),
  get: () => TState,
  config: SyncActionsConfig<TState, TRaw>,
): SyncActions {
  const {
    endpoint,
    serialize,
    deserialize = ((raw: TRaw) => raw) as (raw: TRaw) => Partial<TState>,
    debounceMs = 5000,
    fetchOptions,
  } = config

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const mergedFetchOptions: RequestInit = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...fetchOptions,
  }

  const load = async (): Promise<void> => {
    try {
      const res = await fetch(endpoint, {
        ...mergedFetchOptions,
        method: 'GET',
      })
      if (!res.ok) return
      const raw = (await res.json()) as TRaw
      set({ ...deserialize(raw), loaded: true } as Partial<TState>)
    } catch {
      // load failed, keep loaded = false
    }
  }

  const save = async (): Promise<void> => {
    const state = get()
    if (!(state as any).dirty) return
    try {
      const raw = serialize(state)
      await fetch(endpoint, {
        ...mergedFetchOptions,
        method: 'PUT',
        body: JSON.stringify(raw),
      })
      set({ dirty: false } as Partial<TState>)
    } catch {
      // save failed, dirty stays true
    }
  }

  const markDirty = (): void => {
    set({ dirty: true } as Partial<TState>)
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      save()
    }, debounceMs)
  }

  const cleanup = (): void => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  return {
    loaded: false,
    dirty: false,
    load,
    save,
    markDirty,
    cleanup,
  }
}
