import type { ChartTheme } from '../types'

export function resolveCssVar(varName: string): string {
  if (typeof window === 'undefined') return ''
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return val ? `hsl(${val})` : ''
}

export function resolveChartTheme(): ChartTheme {
  return {
    background: resolveCssVar('--background'),
    foreground: resolveCssVar('--foreground'),
    mutedForeground: resolveCssVar('--muted-foreground'),
    border: resolveCssVar('--border'),
    upColor: 'hsl(160, 84%, 39%)',
    downColor: 'hsl(0, 91%, 71%)',
    upColorTransparent: 'hsla(160, 84%, 39%, 0.4)',
    downColorTransparent: 'hsla(0, 91%, 71%, 0.4)',
  }
}
