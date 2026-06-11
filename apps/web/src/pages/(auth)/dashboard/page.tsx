import { useEffect } from 'react'
import { Skeleton } from '@eous/ui'
import { useDashboardLayoutStore } from '../../../stores/dashboard-layout.js'
import { WorkspaceLayout } from '../../../components/workspace-layout/workspace-layout.js'

export default function DashboardPage() {
  const loading = useDashboardLayoutStore((s) => s.loading)
  const loadAll = useDashboardLayoutStore((s) => s.loadAll)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-1/3 space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <WorkspaceLayout />
    </div>
  )
}
