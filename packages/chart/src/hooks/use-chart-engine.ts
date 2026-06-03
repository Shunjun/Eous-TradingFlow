import { useEffect, useRef } from 'react'
import type { ChartTheme } from '../types'
import { createChartEngine } from '../chart-engine'
import type { ChartEngine } from '../chart-engine'

export function useChartEngine(containerRef: React.RefObject<HTMLDivElement | null>, theme: ChartTheme) {
  const engineRef = useRef<ChartEngine | null>(null)
  const themeRef = useRef(theme)

  // Keep theme ref in sync
  themeRef.current = theme

  // Mount: create chart once
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const engine = createChartEngine(container, themeRef.current)
    engineRef.current = engine

    const observer = new ResizeObserver(() => engine.resize())
    observer.observe(container)

    return () => {
      observer.disconnect()
      engine.destroy()
      engineRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Theme updates
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.applyTheme(theme)
  }, [theme])

  return { engineRef }
}
