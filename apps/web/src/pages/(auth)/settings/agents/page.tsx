import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { AgentSummary, Provider, ProviderModel } from '@eous/api-client'
import {
  Button,
  CardPanel,
  CardPanelBody,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
  Input,
  Label,
  Textarea,
  cn,
} from '@eous/ui'
import { BrainCircuit, Check, Layers3, Loader2, Plus, Save, Trash2, Wrench } from 'lucide-react'
import { api } from '@/lib/api'
import { PageLoading } from '../../../../components/PageLoading'
import { useI18n } from '../../../../lib/i18n'

type AgentDraft = {
  name: string
  description: string
  instructions: string
  providerId: string
  modelId: string
  toolScope: string[]
}

type AgentTemplate = {
  key: string
  name: string
  category: string
  description: string
  toolScope: string[]
  instructions: string
}

const TOOL_OPTIONS = [
  { value: 'market_data', label: 'Market Data' },
  { value: 'technical_analysis', label: 'Technical Analysis' },
  { value: 'fundamental_data', label: 'Fundamental Data' },
  { value: 'capital_flow', label: 'Capital Flow' },
  { value: 'news_research', label: 'News Research' },
  { value: 'sector_analysis', label: 'Sector Analysis' },
  { value: 'screening', label: 'Screening' },
  { value: 'risk', label: 'Risk' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'web_fetch', label: 'Web Fetch' },
]

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: 'blank',
    name: 'Blank Agent',
    category: 'General',
    description: 'Empty profile with the standard instruction sections.',
    toolScope: [],
    instructions: `# Introduction
Describe this agent's identity and area of responsibility.

# Scope
- List the problems this agent should handle.
- List the problems this agent should avoid.

# Working Style
- Explain the expected reasoning and response format.

# Memory
Use long-term memory as background context only.

# Experience
Use prior experience as supporting context only.

# Constraints
- Do not promise investment returns.
- Be explicit when data is missing or stale.`,
  },
  {
    key: 'technical',
    name: 'Technical Analyst',
    category: 'Market Analysis',
    description: 'Trend, momentum, support/resistance, indicators, and volume-price structure.',
    toolScope: ['market_data', 'technical_analysis'],
    instructions: `# Introduction
You are a technical analyst focused on price action, trend structure, momentum, volatility, and volume-price confirmation.

# Scope
- Trend direction and trend strength.
- Moving averages, MACD, RSI, KDJ, Bollinger Bands, support and resistance.
- Volume-price confirmation, breakouts, pullbacks, and failed breakouts.
- Short-term, medium-term, and long-term technical views.

# Working Style
1. Identify the primary trend first.
2. Check momentum, volatility, and volume confirmation.
3. Mark key support, resistance, invalidation, and risk levels.
4. Separate observation from actionable conclusion.

# Memory
Use user preferences and watched symbols as background context only.

# Experience
Use historical pattern reviews as supporting context only.

# Constraints
- Do not promise price targets as certainty.
- State when market data or indicator data is unavailable.`,
  },
  {
    key: 'fundamental',
    name: 'Fundamental Analyst',
    category: 'Market Analysis',
    description: 'Financial quality, valuation, growth, profitability, and company durability.',
    toolScope: ['fundamental_data', 'news_research'],
    instructions: `# Introduction
You are a fundamental analyst focused on company quality, valuation, growth, profitability, and financial risk.

# Scope
- Revenue, earnings, margins, cash flow, debt, and balance sheet quality.
- Valuation multiples and valuation reasonableness.
- Business model durability, industry position, and growth drivers.
- Earnings events, guidance, and material company announcements.

# Working Style
1. Start with business and financial quality.
2. Compare growth and valuation together.
3. Highlight accounting, leverage, and one-off risks.
4. End with what data would change the conclusion.

# Memory
Use long-term preferences as background context only.

# Experience
Use prior company reviews as supporting context only.

# Constraints
- Do not infer missing financial data.
- Separate valuation view from trading timing.`,
  },
  {
    key: 'capital-flow',
    name: 'Capital Flow Analyst',
    category: 'A-share',
    description: 'Main money flow, sector flow, northbound flow, and volume-price divergence.',
    toolScope: ['capital_flow', 'sector_analysis', 'market_data'],
    instructions: `# Introduction
You are a capital flow analyst focused on fund movement, main force behavior, sector rotation, and abnormal volume.

# Scope
- Main fund inflow/outflow and persistence.
- Sector fund rotation and crowded trades.
- Northbound flow, margin financing, and liquidity changes.
- Volume-price divergence, abnormal turnover, and distribution risk.

# Working Style
1. Compare fund flow with price movement.
2. Distinguish one-day spikes from persistent accumulation.
3. Check whether sector flow confirms the individual symbol.
4. Flag suspicious strength, high turnover, and distribution risk.

# Memory
Use watched sectors and preferred market style as background context only.

# Experience
Use prior flow pattern reviews as supporting context only.

# Constraints
- Do not treat fund inflow as a guaranteed bullish signal.
- Explain data freshness and missing flow data clearly.`,
  },
  {
    key: 'risk',
    name: 'Risk Manager',
    category: 'Risk',
    description: 'Position risk, event risk, regulatory risk, drawdown, and invalidation.',
    toolScope: ['risk', 'fundamental_data', 'capital_flow'],
    instructions: `# Introduction
You are a risk manager focused on downside protection, position sizing, event risk, and invalidation conditions.

# Scope
- Unlock schedules, shareholder reduction, regulatory penalties, ST/delisting risk.
- Earnings warning, financial quality deterioration, liquidity risk, and crowded trades.
- Position exposure, stop conditions, drawdown, and concentration risk.

# Working Style
1. Identify the largest loss drivers first.
2. Separate known risks, suspected risks, and missing-data risks.
3. Propose invalidation conditions and monitoring triggers.
4. Keep recommendations conservative when data is incomplete.

# Memory
Use user risk tolerance as background context only.

# Experience
Use prior post-mortems as supporting context only.

# Constraints
- Do not hide low-probability high-impact risks.
- Do not give position sizing without risk assumptions.`,
  },
  {
    key: 'workflow',
    name: 'Workflow Architect',
    category: 'Product',
    description: 'Designs TradingFlow workflows, nodes, prompts, variables, and execution checks.',
    toolScope: ['workflow'],
    instructions: `# Introduction
You are a TradingFlow workflow architect focused on designing, explaining, and safely modifying workflow automation.

# Scope
- Workflow structure, node selection, variable flow, LLM nodes, data-source nodes, and scheduling.
- Prompt design for LLM nodes.
- Workflow validation, execution diagnostics, and incremental edits.

# Working Style
1. Understand the user's target workflow outcome.
2. Prefer small, reviewable changes over full rewrites.
3. Explain node inputs, outputs, and dependencies clearly.
4. Ask before destructive workflow edits.

# Memory
Use user workflow preferences as background context only.

# Experience
Use prior workflow fixes as supporting context only.

# Constraints
- Do not overwrite an entire workflow when a local edit is enough.
- Respect locked nodes unless explicitly authorized.`,
  },
]

const defaultDraft = templateToDraft(AGENT_TEMPLATES[0])

function templateToDraft(template: AgentTemplate): AgentDraft {
  return {
    name: template.name,
    description: template.description,
    instructions: template.instructions,
    providerId: '',
    modelId: '',
    toolScope: template.toolScope,
  }
}

function agentToDraft(agent: AgentSummary): AgentDraft {
  return {
    name: agent.name,
    description: agent.description ?? '',
    instructions: agent.instructions ?? '',
    providerId: agent.providerId ?? '',
    modelId: agent.modelId ?? '',
    toolScope: agent.toolScope ?? [],
  }
}

export default function AgentSettingsPage() {
  const { t } = useI18n()
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [models, setModels] = useState<ProviderModel[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(AGENT_TEMPLATES[0].key)
  const [draft, setDraft] = useState<AgentDraft>(defaultDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  )

  const loadShell = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [agentRes, providerRes] = await Promise.all([api.listAgents(), api.listProviders()])
      setAgents(agentRes.agents)
      setProviders(providerRes.providers)
      const first = agentRes.agents[0] ?? null
      setSelectedAgentId(first?.id ?? null)
      setDraft(first ? agentToDraft(first) : defaultDraft)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToLoadAgentSettings'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadShell()
  }, [loadShell])

  useEffect(() => {
    if (!draft.providerId) {
      setModels([])
      return
    }

    let cancelled = false
    async function loadModels() {
      try {
        const res = await api.getProvider(draft.providerId)
        if (!cancelled) setModels(res.models.filter((model) => model.enabled))
      } catch {
        if (!cancelled) setModels([])
      }
    }
    void loadModels()
    return () => {
      cancelled = true
    }
  }, [draft.providerId])

  function selectAgent(agent: AgentSummary) {
    setSelectedAgentId(agent.id)
    setDraft(agentToDraft(agent))
    setSavedAt(null)
    setError(null)
  }

  function handleAgentCreated(agent: AgentSummary) {
    setAgents((current) => [agent, ...current.filter((item) => item.id !== agent.id)])
    setSelectedAgentId(agent.id)
    setDraft(agentToDraft(agent))
    setSavedAt(new Date().toLocaleTimeString())
    setError(null)
  }

  function handleAgentDeleted(agentId: string) {
    setAgents((current) => {
      const next = current.filter((agent) => agent.id !== agentId)
      const nextSelected = next[0] ?? null
      setSelectedAgentId(nextSelected?.id ?? null)
      setDraft(nextSelected ? agentToDraft(nextSelected) : defaultDraft)
      return next
    })
    setSavedAt(null)
    setError(null)
  }

  function applyTemplate(templateKey: string) {
    const template = AGENT_TEMPLATES.find((item) => item.key === templateKey)
    if (!template) return
    setSelectedTemplateKey(template.key)
    setDraft((current) => ({
      ...templateToDraft(template),
      providerId: current.providerId,
      modelId: current.modelId,
    }))
    setTemplateDialogOpen(false)
  }

  function toggleToolScope(value: string) {
    setDraft((current) => {
      const exists = current.toolScope.includes(value)
      return {
        ...current,
        toolScope: exists
          ? current.toolScope.filter((item) => item !== value)
          : [...current.toolScope, value],
      }
    })
  }

  async function saveAgent() {
    if (!draft.name.trim()) {
      setError(t('settings.agentNameRequired'))
      return
    }
    if (!selectedAgent) {
      setError(t('settings.selectAgentBeforeSaving'))
      return
    }
    if (!draft.providerId || !draft.modelId) {
      setError(t('settings.agentModelRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        instructions: draft.instructions.trim() || null,
        providerId: draft.providerId,
        modelId: draft.modelId,
        toolScope: draft.toolScope,
      }

      const res = await api.updateAgent(selectedAgent.id, payload)

      setAgents((current) => {
        const exists = current.some((agent) => agent.id === res.agent.id)
        return exists
          ? current.map((agent) => (agent.id === res.agent.id ? res.agent : agent))
          : [res.agent, ...current]
      })
      setSelectedAgentId(res.agent.id)
      setDraft(agentToDraft(res.agent))
      setSavedAt(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToSaveAgent'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteAgent() {
    if (!selectedAgent) return
    setDeleting(true)
    setError(null)
    try {
      await api.deleteAgent(selectedAgent.id)
      handleAgentDeleted(selectedAgent.id)
      setDeleteDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToDeleteAgent'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1440px] p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t('settings.agentsTitle')}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
            {t('settings.agentsDescription')}
          </p>
        </div>
        <Button
          size="sm"
          variant="accent-outline"
          className="font-mono"
          onClick={() => setCreateDialogOpen(true)}
        >
          <Plus className="size-3.5" />
          {t('settings.newAgent')}
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid items-start grid-cols-[320px_minmax(0,1fr)] gap-4">
        <CardPanel className="sticky top-6 min-h-[calc(100vh-12rem)] max-h-[calc(100vh-48px)] overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-primary" />
              <div>
                <div className="text-sm font-semibold">{t('settings.agentLibrary')}</div>
                <div className="text-xs text-muted-foreground">
                  {t('settings.agentsConfigured').replace('{count}', String(agents.length))}
                </div>
              </div>
            </div>
          </div>
          <CardPanelBody className="min-h-[calc(100vh-15.6rem)] max-h-[calc(100vh-105px)] overflow-y-auto p-2">
            {loading ? (
              <PageLoading
                label={t('settings.loadingAgents')}
                className="min-h-48 bg-transparent"
              />
            ) : agents.length === 0 ? (
              <Empty className="border-0 p-8">
                <EmptyMedia variant="icon">
                  <BrainCircuit size={20} />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-mono">{t('settings.noAgentsYet')}</EmptyTitle>
                <EmptyDescription className="font-mono text-xs">
                  {t('settings.noAgentsDescription')}
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="space-y-1">
                {agents.map((agent) => (
                  <AgentListButton
                    key={agent.id}
                    active={agent.id === selectedAgentId}
                    title={agent.name}
                    subtitle={agent.modelId ?? t('settings.selectModel')}
                    onClick={() => selectAgent(agent)}
                  />
                ))}
              </div>
            )}
          </CardPanelBody>
        </CardPanel>

        <CardPanel className="min-h-[calc(100vh-12rem)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold">
                  {selectedAgent
                    ? draft.name || t('settings.agentSettings')
                    : t('settings.agentSettings')}
                </h2>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {selectedAgent ? t('settings.profileStored') : t('settings.createAgentToStart')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {savedAt ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="size-3 text-emerald-500" />
                  {t('settings.savedAt').replace('{time}', savedAt)}
                </span>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setTemplateDialogOpen(true)}
                disabled={loading || saving || !selectedAgent}
              >
                <Layers3 className="size-3.5" />
                {t('settings.templates')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={loading || saving || deleting || !selectedAgent}
              >
                <Trash2 className="size-3.5" />
                {t('settings.delete')}
              </Button>
              <Button
                size="sm"
                onClick={() => void saveAgent()}
                disabled={saving || loading || deleting || !selectedAgent}
              >
                {saving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                {t('settings.save')}
              </Button>
            </div>
          </div>

          <CardPanelBody className="p-5">
            {!selectedAgent ? (
              <Empty className="border-0 p-16">
                <EmptyMedia variant="icon">
                  <BrainCircuit size={22} />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-mono">
                  {t('settings.noAgentSelected')}
                </EmptyTitle>
                <EmptyDescription className="font-mono text-xs">
                  {t('settings.noAgentSelectedDescription')}
                </EmptyDescription>
              </Empty>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-5">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {t('settings.name')}
                    </Label>
                    <Input
                      value={draft.name}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {t('settings.description')}
                    </Label>
                    <Input
                      value={draft.description}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, description: event.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      {t('settings.instructions')}
                    </Label>
                    <Textarea
                      className="min-h-[520px] resize-y font-mono text-xs leading-5"
                      value={draft.instructions}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, instructions: event.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <section className="rounded-md border border-border p-3">
                    <div className="mb-3 text-xs font-semibold">{t('settings.defaultModel')}</div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{t('settings.provider')}</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={draft.providerId}
                          onChange={(event) =>
                            setDraft((current) => ({
                              ...current,
                              providerId: event.target.value,
                              modelId: '',
                            }))
                          }
                        >
                          <option value="">{t('settings.selectProvider')}</option>
                          {providers.map((provider) => (
                            <option key={provider.id} value={provider.id}>
                              {provider.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{t('settings.model')}</Label>
                        <select
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={draft.modelId}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, modelId: event.target.value }))
                          }
                          disabled={!draft.providerId}
                        >
                          <option value="">{t('settings.selectModel')}</option>
                          {models.map((model) => (
                            <option key={model.id} value={model.modelId}>
                              {model.displayName ?? model.modelId}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-md border border-border p-3">
                    <div className="mb-3 flex items-center gap-2">
                      <Wrench className="size-4 text-primary" />
                      <div>
                        <div className="text-xs font-semibold">{t('settings.toolScope')}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {t('settings.runtimePermissionHints')}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {TOOL_OPTIONS.map((tool) => (
                        <label key={tool.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={draft.toolScope.includes(tool.value)}
                            onCheckedChange={() => toggleToolScope(tool.value)}
                          />
                          <span>{tool.label}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                </div>
              </div>
            )}
          </CardPanelBody>
        </CardPanel>
      </div>

      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleAgentCreated}
      />

      <TemplateDialog
        open={templateDialogOpen}
        selectedTemplateKey={selectedTemplateKey}
        onSelectedTemplateKeyChange={setSelectedTemplateKey}
        onOpenChange={setTemplateDialogOpen}
        onApply={applyTemplate}
      />

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => !deleting && setDeleteDialogOpen(nextOpen)}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>{t('settings.deleteAgent')}</DialogTitle>
            <DialogDescription>{t('settings.deleteAgentDescription')}</DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium">{selectedAgent?.name ?? t('settings.unknownAgent')}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t('settings.actionCannotBeUndone')}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              {t('settings.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => void deleteAgent()} disabled={deleting}>
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              {t('settings.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateAgentDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (agent: AgentSummary) => void
}) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [templateKey, setTemplateKey] = useState(AGENT_TEMPLATES[0].key)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTemplate =
    AGENT_TEMPLATES.find((template) => template.key === templateKey) ?? AGENT_TEMPLATES[0]

  useEffect(() => {
    if (!open) return
    setName('')
    setTemplateKey(AGENT_TEMPLATES[0].key)
    setError(null)
    setSaving(false)
  }, [open])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setError(t('settings.agentNameRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await api.createAgent({
        name: nextName,
        description: selectedTemplate.description,
        instructions: selectedTemplate.instructions,
        toolScope: selectedTemplate.toolScope,
      })
      onCreated(res.agent)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('settings.failedToCreateAgent'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="sm:max-w-2xl" showCloseButton={!saving}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('settings.newAgent')}</DialogTitle>
            <DialogDescription>{t('settings.newAgentDialogDescription')}</DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {t('settings.name')}
            </Label>
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('settings.agentNamePlaceholder')}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              {t('settings.template')}
            </Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={templateKey}
              onChange={(event) => setTemplateKey(event.target.value)}
              disabled={saving}
            >
              {AGENT_TEMPLATES.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-border">
            <div className="border-b border-border px-3 py-2">
              <div className="text-sm font-medium">{selectedTemplate.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {selectedTemplate.description}
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto p-3">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-5">
                {selectedTemplate.instructions}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('settings.cancel')}
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              {t('settings.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TemplateDialog({
  open,
  selectedTemplateKey,
  onSelectedTemplateKeyChange,
  onOpenChange,
  onApply,
}: {
  open: boolean
  selectedTemplateKey: string
  onSelectedTemplateKeyChange: (key: string) => void
  onOpenChange: (open: boolean) => void
  onApply: (key: string) => void
}) {
  const { t } = useI18n()
  const selectedTemplate =
    AGENT_TEMPLATES.find((template) => template.key === selectedTemplateKey) ?? AGENT_TEMPLATES[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('settings.applyAgentTemplate')}</DialogTitle>
          <DialogDescription>{t('settings.applyAgentTemplateDescription')}</DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[62vh] grid-cols-[260px_minmax(0,1fr)] gap-4 overflow-hidden">
          <div className="space-y-1 overflow-y-auto pr-1">
            {AGENT_TEMPLATES.map((template) => (
              <button
                key={template.key}
                type="button"
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left transition-colors',
                  selectedTemplateKey === template.key ? 'bg-muted' : 'hover:bg-muted/60',
                )}
                onClick={() => onSelectedTemplateKeyChange(template.key)}
              >
                <div className="text-sm font-medium">{template.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">{template.category}</div>
              </button>
            ))}
          </div>

          <div className="min-h-0 overflow-hidden rounded-md border border-border">
            <div className="border-b border-border px-4 py-3">
              <div className="text-sm font-semibold">{selectedTemplate.name}</div>
              <p className="mt-1 text-xs text-muted-foreground">{selectedTemplate.description}</p>
            </div>
            <div className="max-h-[46vh] overflow-y-auto p-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-5">
                {selectedTemplate.instructions}
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('settings.cancel')}
          </Button>
          <Button onClick={() => onApply(selectedTemplateKey)}>
            <Layers3 className="size-3.5" />
            {t('settings.applyTemplate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AgentListButton({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean
  title: string
  subtitle: string
  onClick?: () => void
}) {
  return (
    <button
      className={cn(
        'w-full rounded-md px-3 py-2.5 text-left transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
      )}
      onClick={onClick}
      type="button"
    >
      <div className="truncate text-sm font-medium">{title}</div>
      <div
        className={cn(
          'mt-1 truncate text-xs',
          active ? 'text-primary-foreground/75' : 'text-muted-foreground',
        )}
      >
        {subtitle}
      </div>
    </button>
  )
}
