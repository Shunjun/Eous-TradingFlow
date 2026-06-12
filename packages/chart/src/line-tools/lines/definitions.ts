import {
  ArrowUpRight,
  Crosshair,
  MessageSquare,
  Minus,
  MoveRight,
  MoveUpRight,
  SeparatorVertical,
  Slash,
  TrendingUp,
} from 'lucide-react'
import type { LineToolDefinition } from '../types'

const noopRegister: LineToolDefinition['register'] = () => {}

export const TrendLineDefinition: LineToolDefinition = {
  type: 'TrendLine',
  label: 'Trend Line',
  icon: TrendingUp,
  register: noopRegister,
}

export const ExtendedLineDefinition: LineToolDefinition = {
  type: 'ExtendedLine',
  label: 'Extended Line',
  icon: Slash,
  register: noopRegister,
}

export const RayDefinition: LineToolDefinition = {
  type: 'Ray',
  label: 'Ray',
  icon: MoveUpRight,
  register: noopRegister,
}

export const ArrowDefinition: LineToolDefinition = {
  type: 'Arrow',
  label: 'Arrow',
  icon: ArrowUpRight,
  register: noopRegister,
}

export const HorizontalLineDefinition: LineToolDefinition = {
  type: 'HorizontalLine',
  label: 'Horizontal Line',
  icon: Minus,
  register: noopRegister,
}

export const HorizontalRayDefinition: LineToolDefinition = {
  type: 'HorizontalRay',
  label: 'Horizontal Ray',
  icon: MoveRight,
  register: noopRegister,
}

export const VerticalLineDefinition: LineToolDefinition = {
  type: 'VerticalLine',
  label: 'Vertical Line',
  icon: SeparatorVertical,
  register: noopRegister,
}

export const CrossLineDefinition: LineToolDefinition = {
  type: 'CrossLine',
  label: 'Cross Line',
  icon: Crosshair,
  register: noopRegister,
}

export const CalloutDefinition: LineToolDefinition = {
  type: 'Callout',
  label: 'Callout',
  icon: MessageSquare,
  register: noopRegister,
}
