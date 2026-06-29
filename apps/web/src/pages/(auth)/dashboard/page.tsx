import { useEffect } from 'react'
import { useDashboardLayoutStore } from '../../../stores/dashboard-layout.js'
import { WorkspaceLayout } from '../../../components/workspace-layout/workspace-layout.js'
import { PageLoading } from '../../../components/PageLoading.js'

export default function DashboardPage() {
  const loading = useDashboardLayoutStore((s) => s.loading)
  const loadAll = useDashboardLayoutStore((s) => s.loadAll)

  useEffect(() => {
    loadAll()
  }, [loadAll])

  if (loading) {
    return <PageLoading label="Loading dashboard..." />
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <WorkspaceLayout />
    </div>
  )
}
