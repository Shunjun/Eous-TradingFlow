import {
  Brain,
  CalendarClock,
  CandlestickChart,
  Circle,
  DollarSign,
  FileText,
  GitBranch,
  MessageSquare,
  Play,
  type LucideIcon,
} from 'lucide-react'

const NODE_ICON_MAP: Record<string, LucideIcon> = {
  brain: Brain,
  'calendar-clock': CalendarClock,
  'candlestick-chart': CandlestickChart,
  'dollar-sign': DollarSign,
  'file-text': FileText,
  'git-branch': GitBranch,
  'message-square': MessageSquare,
  play: Play,
}

interface NodeIconProps {
  name: string
  className?: string
}

function NodeIcon({ name, className }: NodeIconProps) {
  const Icon = NODE_ICON_MAP[name] ?? Circle
  return <Icon className={className} />
}

export { NodeIcon, NODE_ICON_MAP }
export type { NodeIconProps }
