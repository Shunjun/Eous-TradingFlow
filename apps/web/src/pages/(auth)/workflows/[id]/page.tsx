import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@eous/ui'
import type { WorkflowDefinition, WorkflowRunDetail, WorkflowVersion } from '@eous/api-client'
import { ArrowLeft, CheckCircle2, Clock3, GitCommitHorizontal, Play, RotateCcw } from 'lucide-react'
import { api } from '../../../../lib/api'
import { useWorkflowListStore } from '../../../../stores/workflows'

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function formatDate(value?: string | null) {
  if (!value) return 'Never'
  return new Date(value).toLocaleString()
}

export default function WorkflowDetailPage() {
  const { id } = useParams()
  const updateWorkflow = useWorkflowListStore((s) => s.updateWorkflow)
  const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null)
  const [versions, setVersions] = useState<WorkflowVersion[]>([])
  const [runs, setRuns] = useState<WorkflowRunDetail[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const selectedRun = useMemo(
    () => runs.find((run) => run.id === selectedRunId) ?? runs[0] ?? null,
    [runs, selectedRunId],
  )

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const [workflowData, versionData, runList] = await Promise.all([
      api.getWorkflow(id),
      api.listWorkflowVersions(id),
      api.getWorkflowRuns(id, 30),
    ])
    setWorkflow(workflowData)
    setVersions(versionData.versions)
    const detailedRuns = await Promise.all(
      runList.runs.slice(0, 10).map((run) => api.getWorkflowRun(id, run.id).then((res) => res.run)),
    )
    setRuns(detailedRuns)
    setSelectedRunId((current) => current ?? detailedRuns[0]?.id ?? null)
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  async function runActive() {
    if (!id) return
    await api.executeWorkflow(id)
    await load()
  }

  async function toggleEnabled() {
    if (!workflow) return
    const result = await api.setWorkflowEnabled(workflow.id, !workflow.enabled)
    setWorkflow(result.workflow)
    updateWorkflow(workflow.id, result.workflow)
  }

  async function activateVersion(versionId: string) {
    if (!workflow) return
    const result = await api.setActiveWorkflowVersion(workflow.id, versionId)
    setWorkflow(result.workflow)
    updateWorkflow(workflow.id, result.workflow)
  }

  async function restoreDraft(versionId: string) {
    if (!workflow) return
    const result = await api.restoreWorkflowVersionToDraft(workflow.id, versionId)
    setWorkflow(result.workflow)
    updateWorkflow(workflow.id, result.workflow)
  }

  if (!id) return null
  if (loading || !workflow) {
    return <div className="p-6 text-sm text-muted-foreground">Loading workflow...</div>
  }

  const activeVersion = versions.find((version) => version.id === workflow.activeVersionId)
  const successRuns = runs.filter((run) => run.status === 'succeeded').length
  const successRate = runs.length ? Math.round((successRuns / runs.length) * 100) : 0

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.12),transparent_30rem)] px-6 py-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-3 gap-2 px-0">
              <Link to="/workflows">
                <ArrowLeft size={15} />
                Workflows
              </Link>
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold">{workflow.name}</h1>
              <Badge variant={workflow.enabled ? 'default' : 'outline'}>
                {workflow.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="secondary">
                {activeVersion ? `v${activeVersion.version}` : 'Draft only'}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {workflow.description || 'No description'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={runActive}>
              <Play size={15} />
              Run
            </Button>
            <Button variant="outline" onClick={toggleEnabled}>
              {workflow.enabled ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/workflows/${workflow.id}/edit`}>Edit draft</Link>
            </Button>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            { label: 'Runs', value: runs.length, icon: Clock3 },
            { label: 'Success rate', value: `${successRate}%`, icon: CheckCircle2 },
            { label: 'Versions', value: versions.length, icon: GitCommitHorizontal },
            { label: 'Last run', value: formatDate(runs[0]?.startedAt), icon: RotateCcw },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border bg-card/85 p-4 shadow-sm backdrop-blur"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.label}</span>
                <item.icon size={15} className="text-primary" />
              </div>
              <div className="mt-3 truncate font-mono text-2xl font-semibold">{item.value}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="gap-4 rounded-lg py-0">
            <CardHeader className="p-5">
              <CardTitle>Versions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 p-5 pt-0">
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No published versions yet.</p>
              ) : (
                <>
                  <Select value={workflow.activeVersionId ?? ''} onValueChange={activateVersion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select active version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version) => (
                        <SelectItem key={version.id} value={version.id}>
                          v{version.version} · {formatDate(version.createdAt)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex flex-col gap-2">
                    {versions.map((version) => (
                      <div key={version.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-sm">v{version.version}</span>
                          {version.id === workflow.activeVersionId && <Badge>Active</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {version.note || formatDate(version.createdAt)}
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() => restoreDraft(version.id)}
                        >
                          Use as draft
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 rounded-lg py-0">
            <CardHeader className="border-b p-5">
              <CardTitle>Run history</CardTitle>
            </CardHeader>
            <CardContent className="grid min-h-[520px] gap-0 p-0 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="border-r">
                {runs.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">No production runs yet.</p>
                ) : (
                  runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={
                        'flex w-full flex-col gap-1 border-b p-4 text-left hover:bg-muted/50 ' +
                        (selectedRun?.id === run.id ? 'bg-muted/60' : '')
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant={run.status === 'succeeded' ? 'default' : 'destructive'}>
                          {run.status}
                        </Badge>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {run.durationMs ?? 0}ms
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(run.startedAt)}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="min-w-0 p-5">
                {selectedRun ? (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {selectedRun.id}
                        </div>
                        <h2 className="mt-1 text-xl font-semibold">{selectedRun.status}</h2>
                      </div>
                      <Badge variant="secondary">{selectedRun.trigger}</Badge>
                    </div>
                    {selectedRun.error && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                        {selectedRun.error}
                      </div>
                    )}
                    <Tabs defaultValue={selectedRun.nodeExecutions[0]?.id ?? 'summary'}>
                      <TabsList className="max-w-full justify-start overflow-x-auto">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        {selectedRun.nodeExecutions.map((node) => (
                          <TabsTrigger key={node.id} value={node.id}>
                            {node.nodeId}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      <TabsContent value="summary" className="mt-4">
                        <JsonBlock
                          value={{
                            status: selectedRun.status,
                            source: selectedRun.source,
                            startedAt: selectedRun.startedAt,
                            finishedAt: selectedRun.finishedAt,
                            durationMs: selectedRun.durationMs,
                            report: selectedRun.report,
                          }}
                        />
                      </TabsContent>
                      {selectedRun.nodeExecutions.map((node) => (
                        <TabsContent key={node.id} value={node.id} className="mt-4">
                          <div className="grid gap-4 xl:grid-cols-2">
                            <div>
                              <h3 className="mb-2 text-sm font-medium">Inputs</h3>
                              <JsonBlock value={node.inputs} />
                            </div>
                            <div>
                              <h3 className="mb-2 text-sm font-medium">Outputs</h3>
                              <JsonBlock value={node.outputs} />
                            </div>
                          </div>
                          <div className="mt-4">
                            <h3 className="mb-2 text-sm font-medium">Logs</h3>
                            <JsonBlock value={node.logs} />
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a run.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
