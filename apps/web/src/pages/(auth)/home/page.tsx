import {
  GitBranch,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  Plus,
  Search,
  Workflow,
  BrainCircuit,
  Activity,
} from 'lucide-react'
import {
  Button,
  Dot,
  IconBox,
  StatusBadge,
  MetricCard,
  CardPanel,
  CardPanelHeader,
  CardPanelBody,
  DataRow,
  Input,
  cn,
} from '@eous/ui'

/* ─── Workflow row ─── */
function WorkflowRow({
  name,
  status,
  lastRun,
  nodes,
  type,
}: {
  name: string
  status: 'running' | 'completed' | 'failed' | 'idle'
  lastRun: string
  nodes: number
  type: string
}) {
  const statusLabel = { running: 'Running', completed: 'Completed', failed: 'Failed', idle: 'Idle' }

  return (
    <DataRow
      leading={
        <IconBox size="md">
          {type === 'workflow' ? (
            <GitBranch size={14} className="text-muted-foreground" />
          ) : (
            <BrainCircuit size={14} className="text-muted-foreground" />
          )}
        </IconBox>
      }
      trailing={
        <StatusBadge status={status} label={statusLabel[status]} />
      }
    >
      <p className="text-sm font-medium truncate">{name}</p>
      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
        {nodes} nodes · {lastRun}
      </p>
    </DataRow>
  )
}

/* ─── Watchlist row ─── */
function WatchlistRow({
  symbol,
  name,
  price,
  change24h,
}: {
  symbol: string
  name: string
  price: string
  change24h: string
}) {
  const isUp = change24h.startsWith('+')
  return (
    <DataRow
      leading={
        <IconBox size="md" className="font-mono text-[10px] font-bold text-muted-foreground">
          {symbol.slice(0, 2)}
        </IconBox>
      }
      trailing={
        <div className="text-right">
          <p className="font-mono text-sm">${price}</p>
          <p className={cn('font-mono text-[11px]', isUp ? 'text-emerald-500' : 'text-red-400')}>
            {change24h}
          </p>
        </div>
      }
    >
      <p className="text-sm font-medium">{symbol}</p>
      <p className="text-[11px] text-muted-foreground truncate">{name}</p>
    </DataRow>
  )
}

/* ─── Execution log entry ─── */
function ExecutionLog({
  workflow,
  status,
  time,
  duration,
}: {
  workflow: string
  status: 'success' | 'error' | 'running'
  time: string
  duration: string
}) {
  const icons = {
    success: <CheckCircle2 size={12} className="text-emerald-500" />,
    error: <AlertTriangle size={12} className="text-red-400" />,
    running: <Dot size="sm" variant="glow" />,
  }

  return (
    <DataRow
      leading={icons[status]}
      trailing={
        <div className="flex items-center gap-4">
          <span className="font-mono text-muted-foreground text-xs">{duration}</span>
          <span className="font-mono text-muted-foreground/60 text-xs">{time}</span>
        </div>
      }
    >
      <span className="text-xs truncate">{workflow}</span>
    </DataRow>
  )
}

/* ─── Home page ─── */
export default function HomePage() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Home</h1>
          <p className="text-sm text-muted-foreground mt-0.5 font-mono text-xs">
            Overview of your trading analysis platform
          </p>
        </div>
        <Button variant="accent-outline" size="sm" className="font-mono gap-2">
          <Plus size={14} />
          New Workflow
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Workflows" value="12" change="+2 this week" icon={GitBranch} trend="up" />
        <MetricCard label="Executions" value="847" change="+56 today" icon={Play} trend="up" />
        <MetricCard label="Success Rate" value="94.2%" change="-0.3%" icon={CheckCircle2} trend="down" />
        <MetricCard label="Active Agents" value="3" change="2 running" icon={BrainCircuit} trend="neutral" />
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Recent Workflows — takes 2 columns */}
        <CardPanel className="lg:col-span-2">
          <CardPanelHeader icon={Workflow} title="Recent Workflows" action={{ label: 'View all' }} />
          <CardPanelBody>
            <WorkflowRow name="AAPL Daily Analysis" status="running" lastRun="2 min ago" nodes={8} type="workflow" />
            <WorkflowRow name="Crypto Sentiment Scanner" status="completed" lastRun="15 min ago" nodes={12} type="workflow" />
            <WorkflowRow name="Macro News Digest" status="completed" lastRun="1 hour ago" nodes={6} type="agent" />
            <WorkflowRow name="Sector Rotation Alert" status="failed" lastRun="3 hours ago" nodes={10} type="workflow" />
            <WorkflowRow name="Earnings Whisper" status="idle" lastRun="yesterday" nodes={5} type="agent" />
          </CardPanelBody>
        </CardPanel>

        {/* Watchlist */}
        <CardPanel>
          <CardPanelHeader icon={Activity} title="Watchlist" action={{ label: 'Manage' }} />
          <CardPanelBody>
            <WatchlistRow symbol="AAPL" name="Apple Inc." price="189.84" change24h="+1.23%" />
            <WatchlistRow symbol="TSLA" name="Tesla Inc." price="248.42" change24h="-2.15%" />
            <WatchlistRow symbol="BTC" name="Bitcoin" price="67,842" change24h="+3.41%" />
            <WatchlistRow symbol="ETH" name="Ethereum" price="3,521" change24h="+1.87%" />
            <WatchlistRow symbol="NVDA" name="NVIDIA" price="875.38" change24h="+0.92%" />
          </CardPanelBody>
        </CardPanel>
      </div>

      {/* Execution log */}
      <CardPanel>
        <CardPanelHeader
          icon={Clock}
          title="Recent Executions"
          action={{
            label: (
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 7 success
                </span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-red-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> 1 failed
                </span>
              </div>
            ),
          }}
        />
        <CardPanelBody>
          <ExecutionLog workflow="AAPL Daily Analysis" status="running" time="now" duration="—" />
          <ExecutionLog workflow="Crypto Sentiment Scanner" status="success" time="15m ago" duration="4.2s" />
          <ExecutionLog workflow="Macro News Digest" status="success" time="1h ago" duration="8.7s" />
          <ExecutionLog workflow="Sector Rotation Alert" status="error" time="3h ago" duration="2.1s" />
          <ExecutionLog workflow="Earnings Whisper" status="success" time="yesterday" duration="12.3s" />
        </CardPanelBody>
      </CardPanel>

      {/* Input demo */}
      <CardPanel>
        <CardPanelHeader icon={Search} title="Input Component" />
        <CardPanelBody className="p-4 space-y-3">
          <Input placeholder="Default input" />
          <Input placeholder="With font-mono" className="font-mono text-xs" />
          <Input placeholder="Disabled" disabled />
        </CardPanelBody>
      </CardPanel>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: GitBranch, label: 'New Workflow', desc: 'Visual DAG editor' },
          { icon: BrainCircuit, label: 'New Agent', desc: 'AI analysis agent' },
          { icon: ArrowUpRight, label: 'Quick Analysis', desc: 'One-off symbol scan' },
        ].map(({ icon: Icon, label, desc }) => (
          <button
            key={label}
            className="flex items-center gap-3 p-4 rounded-lg border border-border
                       hover:border-primary/30 hover:bg-primary/5
                       transition-all duration-300 group text-left"
          >
            <IconBox size="lg">
              <Icon size={16}
                    className="text-muted-foreground group-hover:text-primary transition-colors" />
            </IconBox>
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
