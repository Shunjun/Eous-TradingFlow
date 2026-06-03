import { useEffect, useState } from 'react'
import type { ChartTheme } from '../types'
import { resolveChartTheme } from '../utils/chart-theme'

/**
 * Tracks the actual resolved theme by watching DOM class changes.
 * Unlike useTheme() which returns the user preference (may be 'system'),
 * this reads the CSS variables that are actually applied.
 */
export function useResolvedTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(() => resolveChartTheme())

  useEffect(() => {
    const root = document.documentElement

    // Sync immediately — class is already on DOM from ThemeProvider
    setTheme(resolveChartTheme())

    // Watch for future class changes (light/dark toggle)
    const observer = new MutationObserver(() => {
      setTheme(resolveChartTheme())
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  return theme
}
