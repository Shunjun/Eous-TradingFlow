import type { WorkflowSliceCreator, WorkflowStatusSlice } from './types'

const createStatusSlice: WorkflowSliceCreator<WorkflowStatusSlice> = (set) => ({
  isDirty: false,
  lastModified: 0,

  markDirty: () => set({ isDirty: true, lastModified: Date.now() }),
  markClean: () => set({ isDirty: false }),
})

export { createStatusSlice }
