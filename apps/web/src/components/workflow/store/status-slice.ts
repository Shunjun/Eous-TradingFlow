import type { WorkflowSliceCreator, WorkflowStatusSlice } from './types'

const createStatusSlice: WorkflowSliceCreator<WorkflowStatusSlice> = (set) => ({
  isDirty: false,
  lastModified: 0,
  executionRefreshToken: 0,
  recentExecutionIds: [],

  markDirty: () => set({ isDirty: true, lastModified: Date.now() }),
  markClean: () => set({ isDirty: false }),
  markExecutionChanged: (executionIds = []) =>
    set({ executionRefreshToken: Date.now(), recentExecutionIds: executionIds }),
})

export { createStatusSlice }
