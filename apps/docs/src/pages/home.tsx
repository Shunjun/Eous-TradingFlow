import { useEffect, useState, useRef } from 'react'
import {
  Workflow,
  BrainCircuit,
  Activity,
  ArrowRight,
  GitBranch,
  Layers,
  Cpu,
  Zap,
  ChevronRight,
} from 'lucide-react'
import { Button, IconBox, StatusBadge, SectionHeader, MetricCard, Dot } from '@eous/ui'

/* ─── Animated node background for hero ─── */
function HeroNodeGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let w = 0
    let h = 0

    interface Node {
      x: number
      y: number
      vx: number
      vy: number
      r: number
    }

    const nodes: Node[] = []

    function resize() {
      const dpr = window.devicePixelRatio || 1
      w = canvas!.parentElement!.offsetWidth
      h = canvas!.parentElement!.offsetHeight
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      canvas!.style.width = w + 'px'
      canvas!.style.height = h + 'px'
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function initNodes() {
      nodes.length = 0
      const count = Math.floor((w * h) / 25000)
      for (let i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 2 + 1,
        })
      }
    }

    function draw() {
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.15
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(249, 115, 22, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      for (const node of nodes) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(249, 115, 22, ${0.3 + node.r * 0.15})`
        ctx.fill()

        node.x += node.vx
        node.y += node.vy
        if (node.x < 0 || node.x > w) node.vx *= -1
        if (node.y < 0 || node.y > h) node.vy *= -1
      }

      animId = requestAnimationFrame(draw)
    }

    resize()
    initNodes()
    draw()

    const onResize = () => {
      resize()
      initNodes()
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return (
    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.6 }} />
  )
}

/* ─── Architecture diagram: node system flow ─── */
function ArchitectureDiagram() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const nodeTypes = [
    { id: 'source', label: 'Data Source', icon: Activity, x: 0, y: 50, color: '#22c55e' },
    { id: 'compute', label: 'Compute', icon: Cpu, x: 200, y: 50, color: '#3b82f6' },
    { id: 'llm', label: 'LLM Agent', icon: BrainCircuit, x: 400, y: 50, color: '#a855f7' },
    { id: 'output', label: 'Output', icon: Zap, x: 600, y: 50, color: '#f97316' },
  ]

  return (
    <div className="relative">
      {/* Desktop layout */}
      <div className="hidden md:block">
        <svg viewBox="0 0 700 120" className="w-full max-w-2xl mx-auto">
          {nodeTypes.slice(0, -1).map((node, i) => {
            const next = nodeTypes[i + 1]
            const isHighlighted = hoveredNode === node.id || hoveredNode === next.id
            return (
              <line
                key={`line-${i}`}
                x1={node.x + 80}
                y1={node.y + 25}
                x2={next.x + 10}
                y2={next.y + 25}
                stroke={isHighlighted ? '#f97316' : 'currentColor'}
                strokeWidth={isHighlighted ? 2 : 1}
                className="text-border transition-all duration-300 flow-line"
                style={{ strokeDasharray: isHighlighted ? 'none' : '5 5' }}
              />
            )
          })}

          {nodeTypes.map((node) => {
            const Icon = node.icon
            const isHovered = hoveredNode === node.id
            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                <rect
                  x={node.x}
                  y={node.y}
                  width={80}
                  height={50}
                  rx={4}
                  fill={isHovered ? `${node.color}15` : 'transparent'}
                  stroke={isHovered ? node.color : 'currentColor'}
                  strokeWidth={isHovered ? 1.5 : 1}
                  className="text-border transition-all duration-300"
                />
                <foreignObject x={node.x + 28} y={node.y + 6} width={24} height={24}>
                  <div
                    className="text-muted-foreground transition-colors duration-300"
                    style={{ color: isHovered ? node.color : undefined }}
                  >
                    <Icon size={18} />
                  </div>
                </foreignObject>
                <text
                  x={node.x + 40}
                  y={node.y + 40}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[9px] font-mono transition-all duration-300"
                  style={{ fill: isHovered ? node.color : undefined }}
                >
                  {node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden flex flex-col items-center gap-3">
        {nodeTypes.map((node, i) => {
          const Icon = node.icon
          const isHovered = hoveredNode === node.id
          return (
            <div key={node.id} className="flex items-center gap-3">
              <div
                className="flex items-center gap-2 px-4 py-2.5 rounded border transition-all duration-300"
                style={{
                  borderColor: isHovered ? node.color : undefined,
                  background: isHovered ? `${node.color}10` : 'transparent',
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <Icon
                  size={16}
                  style={{ color: isHovered ? node.color : undefined }}
                  className="text-muted-foreground transition-colors"
                />
                <span
                  className="font-mono text-xs text-muted-foreground transition-colors"
                  style={{ color: isHovered ? node.color : undefined }}
                >
                  {node.label}
                </span>
              </div>
              {i < nodeTypes.length - 1 && <ChevronRight size={14} className="text-border" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Feature card ─── */
function FeatureCard({
  icon: Icon,
  title,
  description,
  tag,
}: {
  icon: React.ElementType
  title: string
  description: string
  tag: string
}) {
  return (
    <div className="line-card rounded-lg p-6 group cursor-default">
      <div className="flex items-center gap-3 mb-4">
        <IconBox size="lg" className="group-hover:border-primary/40 group-hover:bg-primary/5">
          <Icon
            size={18}
            className="text-muted-foreground group-hover:text-primary transition-colors duration-300"
          />
        </IconBox>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground
                         border border-border rounded px-1.5 py-0.5
                         group-hover:border-primary/30 group-hover:text-primary
                         transition-all duration-300"
        >
          {tag}
        </span>
      </div>
      <h3 className="font-sans font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}

/* ─── Main page ─── */
export function HomePage() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(true)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative overflow-hidden">
      {/* ─── Grid background ─── */}
      <div className="fixed inset-0 grid-bg pointer-events-none" />

      {/* ─── Navigation ─── */}
      <nav
        className="relative z-10 flex items-center justify-between px-6 md:px-12 py-5
                      border-b border-border/50"
      >
        <div className="flex items-center gap-2.5">
          <IconBox size="sm" className="border-primary bg-primary/10" interactive={false}>
            <GitBranch size={14} className="text-primary" />
          </IconBox>
          <span className="font-mono font-bold text-sm tracking-wide">EOUS</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#architecture"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Architecture
          </a>
          <a
            href="#docs"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </a>
        </div>
        <Button variant="accent-outline" size="sm" className="font-mono text-xs">
          Get Started
          <ArrowRight size={14} className="ml-1.5" />
        </Button>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative z-10 min-h-[85vh] flex items-center justify-center px-6">
        <HeroNodeGraph />

        <div className="relative z-10 text-center max-w-3xl mx-auto">
          {/* Status badge */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border
                        mb-8 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Dot size="sm" variant="glow" />
            <span className="font-mono text-[11px] text-muted-foreground tracking-wide">
              P0 Architecture Complete
            </span>
          </div>

          {/* Main heading */}
          <h1
            className={`font-mono text-5xl md:text-7xl font-bold tracking-tight mb-6
                        transition-all duration-700 delay-100 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <span className="text-foreground">EOUS</span>
            <span className="text-primary">.</span>
          </h1>

          {/* Tagline */}
          <p
            className={`text-lg md:text-xl text-muted-foreground mb-4 max-w-xl mx-auto leading-relaxed
                        transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Low-code trading analysis.
            <br />
            Visual workflow. AI-powered.
          </p>

          {/* Subtitle */}
          <p
            className={`text-sm text-muted-foreground/70 mb-10 max-w-md mx-auto font-mono
                        transition-all duration-700 delay-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            Connect data sources, compute, and LLM agents into a visual DAG. Run it. See every step.
          </p>

          {/* CTA buttons */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-3
                        transition-all duration-700 delay-[400ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Button variant="glow" size="lg">
              Start Building
              <ArrowRight size={16} className="ml-2" />
            </Button>
            <Button variant="accent-outline" size="lg" className="font-mono text-sm">
              View on GitHub
            </Button>
          </div>

          {/* Stats */}
          <div
            className={`flex items-center justify-center gap-4 mt-14
                        transition-all duration-700 delay-[500ms] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <MetricCard label="Node Types" value="8+" variant="compact" />
            <MetricCard label="Providers" value="5" variant="compact" />
            <MetricCard label="License" value="MIT" variant="compact" />
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="Capabilities"
            heading="Everything you need."
            headingAccent=" Nothing you don't."
            description="Three pillars that make Eous different from traditional trading tools."
          />

          {/* Feature cards */}
          <div className="grid md:grid-cols-3 gap-4 mt-14">
            <FeatureCard
              icon={Workflow}
              title="Visual Workflow"
              description="Drag nodes onto a canvas. Connect data sources to compute to LLM agents. Your analysis logic as a DAG you can see, modify, and share."
              tag="01 / workflow"
            />
            <FeatureCard
              icon={BrainCircuit}
              title="AI-Powered Analysis"
              description="LLM is a first-class node, not a bolt-on. Feed it market data, news, indicators — get structured signals or natural language reports."
              tag="02 / llm"
            />
            <FeatureCard
              icon={Activity}
              title="Real-time Data"
              description="Market prices, news feeds, on-chain data. Pluggable providers with caching. WebSocket push for live execution monitoring."
              tag="03 / data"
            />
          </div>

          {/* Additional feature strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[
              { icon: Layers, label: 'Dockview Layout' },
              { icon: GitBranch, label: 'DAG Execution' },
              { icon: Cpu, label: 'Sandboxed Python' },
              { icon: Zap, label: 'WebSocket Realtime' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-4 py-3 rounded-lg border border-border
                           hover:border-primary/30 hover:bg-primary/5
                           transition-all duration-300 group cursor-default"
              >
                <IconBox size="sm" interactive>
                  <Icon
                    size={15}
                    className="text-muted-foreground group-hover:text-primary transition-colors"
                  />
                </IconBox>
                <span className="font-mono text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Architecture ─── */}
      <section id="architecture" className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-5xl mx-auto">
          <SectionHeader
            label="Architecture"
            heading="Four layers."
            headingAccent=" One canvas."
            description="Data flows upward. Each layer is independent, composable, and replaceable."
          />

          {/* Architecture diagram */}
          <div className="border border-border rounded-lg p-8 dot-grid relative overflow-hidden mt-14">
            {/* Corner decorations */}
            <div className="absolute top-3 left-3 w-2 h-2 border-t border-l border-primary/30" />
            <div className="absolute top-3 right-3 w-2 h-2 border-t border-r border-primary/30" />
            <div className="absolute bottom-3 left-3 w-2 h-2 border-b border-l border-primary/30" />
            <div className="absolute bottom-3 right-3 w-2 h-2 border-b border-r border-primary/30" />

            <ArchitectureDiagram />

            {/* Layer labels */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Data Source', desc: 'Market, News, On-chain', color: '#22c55e' },
                { label: 'Compute', desc: 'Indicators, Python, Custom', color: '#3b82f6' },
                { label: 'LLM Agent', desc: 'OpenAI, Anthropic, Ollama', color: '#a855f7' },
                { label: 'Output', desc: 'Signals, Reports, Charts', color: '#f97316' },
              ].map(({ label, desc, color }) => (
                <div key={label} className="text-center">
                  <div
                    className="w-full h-1 rounded-full mb-2"
                    style={{ background: `${color}30` }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ background: color, width: '40%' }}
                    />
                  </div>
                  <p className="font-mono text-[11px] font-medium" style={{ color }}>
                    {label}
                  </p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {['React 19', 'Vite 6', 'Hono', 'Prisma', 'SQLite', 'React Flow', 'Zustand'].map(
              (tech) => (
                <span
                  key={tech}
                  className="font-mono text-[11px] text-muted-foreground/60 hover:text-muted-foreground
                             transition-colors cursor-default"
                >
                  {tech}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative z-10 px-6 md:px-12 py-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="line-card rounded-xl p-10 md:p-14 relative overflow-hidden">
            {/* Decorative corner lines */}
            <div className="absolute top-4 left-4">
              <div className="w-8 h-px bg-primary/40" />
              <div className="w-px h-8 bg-primary/40" />
            </div>
            <div className="absolute bottom-4 right-4">
              <div className="w-8 h-px bg-primary/40" />
              <div className="w-px h-8 bg-primary/40" />
            </div>

            <h2 className="font-mono text-2xl md:text-3xl font-bold mb-4">Ready to build?</h2>
            <p className="text-muted-foreground text-sm mb-8 max-w-md mx-auto">
              P0 architecture is complete. Start defining your first workflow today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button variant="glow" size="lg">
                Get Started
                <ArrowRight size={16} className="ml-2" />
              </Button>
              <Button variant="accent-outline" size="lg" className="font-mono text-sm">
                Read the Docs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="relative z-10 border-t border-border/50 px-6 md:px-12 py-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-primary" />
            <span className="font-mono text-xs text-muted-foreground">Eous TradingFlow</span>
            <span className="font-mono text-[10px] text-muted-foreground/50 ml-2">v0.0.0</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <a
              href="#"
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Docs
            </a>
            <a
              href="#"
              className="font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Changelog
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
