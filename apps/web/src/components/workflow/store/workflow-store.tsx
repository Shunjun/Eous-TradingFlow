import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { createDocumentSlice } from './document-slice'
import { createHistorySlice } from './history-slice'
import { createStatusSlice } from './status-slice'
import { createUiSlice } from './ui-slice'
import type { WorkflowEditorState, WorkflowStore } from './types'

function createWorkflowStore(): WorkflowStore {
  return createStore<WorkflowEditorState>((set, get, store) => ({
    ...createDocumentSlice(set, get, store),
    ...createHistorySlice(set, get, store),
    ...createStatusSlice(set, get, store),
    ...createUiSlice(set, get, store),
    reset: () =>
      set({
        nodes: [],
        edges: [],
        activeWorkflowId: null,
        workflowName: '',
        isDirty: false,
        lastModified: 0,
        past: [],
        future: [],
        pendingOps: [],
        selectedNodeId: null,
        canvasMode: 'pan',
        logOpen: false,
        clipboardNode: null,
      }),
  }))
}

const WorkflowStoreContext = createContext<WorkflowStore | null>(null)

function WorkflowStoreProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<WorkflowStore | null>(null)
  if (!storeRef.current) storeRef.current = createWorkflowStore()

  return (
    <WorkflowStoreContext.Provider value={storeRef.current}>
      {children}
    </WorkflowStoreContext.Provider>
  )
}

function useWorkflowStore<T>(selector: (state: WorkflowEditorState) => T): T {
  const store = useContext(WorkflowStoreContext)
  if (!store) throw new Error('useWorkflowStore must be used within WorkflowStoreProvider')
  return useStore(store, selector)
}

function useWorkflowStoreApi(): WorkflowStore {
  const store = useContext(WorkflowStoreContext)
  if (!store) throw new Error('useWorkflowStoreApi must be used within WorkflowStoreProvider')
  return store
}

export { WorkflowStoreProvider, createWorkflowStore, useWorkflowStore, useWorkflowStoreApi }
export type { WorkflowEditorState, WorkflowHistoryEntry, WorkflowStore } from './types'
