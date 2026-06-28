import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  ToggleGroup,
  ToggleGroupItem,
} from '@eous/ui'
import {
  Activity,
  CheckCircle2,
  Clock3,
  Grid2X2,
  List,
  PauseCircle,
  Play,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react'
import { api } from '../../../lib/api'
import { useWorkflowList } from '../../../hooks/use-workflows'
import { useWorkflowListStore } from '../../../stores/workflows'
import { CreateWorkflowDialog } from '../../../components/workflow/dialogs'

type ViewMode = 'cards' | 'list'
type StatusFilter = 'all' | 'enabled' | 'disabled'

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export default function WorkflowsPage() {
  const navigate = useNavigate()
  const { workflows, loading, refresh } = useWorkflowList()
  const deleteWorkflow = useWorkflowListStore((s) => s.deleteWorkflow)
  const updateWorkflow = useWorkflowListStore((s) => s.updateWorkflow)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [view, setView] = useState<ViewMode>('cards')
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return workflows.filter((workflow) => {
      if (status === 'enabled' && !workflow.enabled) return false
      if (status === 'disabled' && workflow.enabled) return false
      if (!q) return true
      return (
        workflow.name.toLowerCase().includes(q) ||
        (workflow.description ?? '').toLowerCase().includes(q)
      )
    })
  }, [query, status, workflows])

  const stats = useMemo(
    () => ({
      total: workflows.length,
      enabled: workflows.filter((item) => item.enabled).length,
      published: workflows.filter((item) => item.activeVersionId).length,
      draftOnly: workflows.filter((item) => !item.activeVersionId).length,
    }),
    [workflows],
  )

  async function toggleEnabled(id: string, enabled: boolean) {
    const result = await api.setWorkflowEnabled(id, enabled)
    updateWorkflow(id, result.workflow)
  }

  async function runWorkflow(id: string) {
    await api.executeWorkflow(id)
    await refresh()
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    await deleteWorkflow(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_34rem)] px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase text-muted-foreground">Automation desk</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-foreground">
              Workflows
            </h1>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="w-fit gap-2">
            <Plus size={16} />
            New workflow
          </Button>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, icon: Activity },
            { label: 'Enabled', value: stats.enabled, icon: CheckCircle2 },
            { label: 'Published', value: stats.published, icon: Clock3 },
            { label: 'Draft only', value: stats.draftOnly, icon: PauseCircle },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-border/70 bg-card/80 p-4 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                <item.icon size={15} className="text-primary" />
              </div>
              <div className="mt-3 font-mono text-3xl font-semibold">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-3 rounded-lg border bg-card/80 p-3 shadow-sm backdrop-blur md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows"
              className="pl-9"
            />
          </div>
          <ToggleGroup
            type="single"
            value={status}
            onValueChange={(value) => value && setStatus(value as StatusFilter)}
            className="justify-start"
          >
            <ToggleGroupItem value="all">All</ToggleGroupItem>
            <ToggleGroupItem value="enabled">Enabled</ToggleGroupItem>
            <ToggleGroupItem value="disabled">Disabled</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as ViewMode)}
          >
            <ToggleGroupItem value="cards" aria-label="Card view">
              <Grid2X2 size={15} />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List size={15} />
            </ToggleGroupItem>
          </ToggleGroup>
        </section>

        {loading ? (
          <div className="rounded-lg border bg-card p-8 text-sm text-muted-foreground">
            Loading workflows...
          </div>
        ) : view === 'cards' ? (
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((workflow) => (
              <Card key={workflow.id} className="gap-4 rounded-lg py-0">
                <CardHeader className="gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{workflow.name}</CardTitle>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {workflow.description || 'No description'}
                      </p>
                    </div>
                    <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                      {workflow.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-5 pt-0">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-muted-foreground">Published</div>
                      <div className="mt-1 font-mono">
                        {workflow.activeVersionId ? 'Active version' : 'Draft only'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Updated</div>
                      <div className="mt-1 font-mono">{formatDate(workflow.updatedAt)}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2" onClick={() => runWorkflow(workflow.id)}>
                      <Play size={14} />
                      Run
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/workflows/${workflow.id}`}>Detail</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/workflows/${workflow.id}/edit`}>Edit</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleEnabled(workflow.id, !workflow.enabled)}
                    >
                      {workflow.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="grid grid-cols-[minmax(240px,1fr)_120px_160px_260px] border-b px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Name</span>
              <span>Status</span>
              <span>Published</span>
              <span>Actions</span>
            </div>
            {filtered.map((workflow) => (
              <div
                key={workflow.id}
                className="grid grid-cols-[minmax(240px,1fr)_120px_160px_260px] items-center border-b px-4 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <Link
                    to={`/workflows/${workflow.id}`}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {workflow.name}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {workflow.description || 'No description'}
                  </div>
                </div>
                <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                  {workflow.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {workflow.activeVersionId ? 'Active' : 'Draft only'}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" onClick={() => runWorkflow(workflow.id)}>
                    <Play size={14} />
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link to={`/workflows/${workflow.id}/edit`}>Edit</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleEnabled(workflow.id, !workflow.enabled)}
                  >
                    {workflow.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setDeleteTarget({ id: workflow.id, name: workflow.name })}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </section>
        )}

        {filtered.length === 0 && !loading && (
          <div className="rounded-lg border bg-card p-10 text-center">
            <XCircle className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No workflows found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Adjust filters or create a new one.
            </p>
          </div>
        )}
      </div>

      <CreateWorkflowDialog
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          navigate(`/workflows/${id}/edit`)
        }}
      />
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete workflow</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.name}? Versions and run history will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
