import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'

export type SerializableViewState = object

export interface ViewStateBridge<TState extends SerializableViewState, TProps extends object> {
  state: TState
  props: TProps
  title: string
}

export type ViewType = 'kline'

export interface ViewRegistryEntry<
  TState extends SerializableViewState = SerializableViewState,
  TProps extends object = object,
> {
  type: ViewType
  label: string
  icon: ComponentType<LucideProps>
  Component: ComponentType<TProps>
  useViewState: (
    initialState: unknown,
    onChange: (state: TState) => void,
  ) => ViewStateBridge<TState, TProps>
  createDefaultState: () => TState
}
