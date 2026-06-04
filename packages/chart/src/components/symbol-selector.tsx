'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn, Dialog, DialogContent, DialogHeader, DialogTitle, Input } from '@eous/ui'
import { Search, ChevronDown } from 'lucide-react'
import type { ProviderOption, SymbolItem } from '../types'

// ── Props ───────────────────────────────────────────────────────────────────

interface SymbolSelectorProps {
  symbol?: string
  providers: ProviderOption[]
  symbols: SymbolItem[]
  activeProviderId: string
  onSymbolSelect: (item: SymbolItem) => void
  onSearchChange?: (query: string) => void
  onProviderChange: (providerId: string) => void
  loading?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
  containerRef?: React.RefObject<HTMLElement | null>
}

// ── Component ───────────────────────────────────────────────────────────────

export function SymbolSelector({
  symbol,
  providers,
  symbols,
  activeProviderId,
  onSymbolSelect,
  onSearchChange,
  onProviderChange,
  loading,
  onLoadMore,
  hasMore,
  loadingMore,
  containerRef,
}: SymbolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(-1)
      // Auto-focus search input
      requestAnimationFrame(() => searchRef.current?.focus())
    }
  }, [open])

  // Reset active index when symbol list changes
  useEffect(() => {
    setActiveIndex(-1)
  }, [symbols.length])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return
    const items = listRef.current.querySelectorAll('[data-symbol-item]')
    items[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!open || !hasMore || !onLoadMore || loadingMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore()
        }
      },
      { root: listRef.current, threshold: 0.1 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, hasMore, onLoadMore, loadingMore])

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value)
      onSearchChange?.(value)
    },
    [onSearchChange],
  )

  const handleSelect = useCallback(
    (item: SymbolItem) => {
      onSymbolSelect(item)
      setOpen(false)
    },
    [onSymbolSelect],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setActiveIndex((prev) => Math.min(prev + 1, symbols.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setActiveIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (activeIndex >= 0 && activeIndex < symbols.length) {
            handleSelect(symbols[activeIndex])
          }
          break
        case 'Escape':
          if (query) {
            e.preventDefault()
            handleSearchChange('')
          } else {
            setOpen(false)
          }
          break
      }
    },
    [symbols, activeIndex, query, handleSelect, handleSearchChange],
  )

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors',
          'text-foreground hover:bg-muted/50',
        )}
      >
        <span className="font-medium">{symbol ?? '—'}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          container={containerRef?.current ?? null}
          noOverlay
          className="max-w-md p-0 gap-0"
          onKeyDown={handleKeyDown}
        >
          <DialogHeader className="px-4 pt-4 pb-3">
            <DialogTitle className="text-sm font-mono">Symbol Search</DialogTitle>
          </DialogHeader>

          {/* Search input */}
          <div className="px-4 pb-2">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                ref={searchRef}
                placeholder="Search by symbol, name or exchange..."
                value={query}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-8 pl-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Provider tabs */}
          {providers.length > 1 && (
            <div className="flex items-center gap-1 px-4 pb-2 border-b border-border">
              {providers.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onProviderChange(p.id)}
                  className={cn(
                    'px-2 py-1 text-[10px] font-mono rounded transition-colors',
                    p.id === activeProviderId
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Symbol list */}
          <div ref={listRef} className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground font-mono">
                Loading...
              </div>
            ) : symbols.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground font-mono">
                No symbols found
              </div>
            ) : (
              <>
                {symbols.map((item, index) => (
                  <button
                    key={`${item.providerId}-${item.symbol}`}
                    data-symbol-item
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'flex items-center w-full px-4 py-2 text-left transition-colors',
                      index === activeIndex ? 'bg-primary/10' : 'hover:bg-muted/50',
                    )}
                  >
                    <span className="text-xs font-mono font-medium text-foreground min-w-[5rem]">
                      {item.symbol}
                    </span>
                    {item.exchange && (
                      <span className="text-[10px] font-mono text-muted-foreground ml-2 px-1 py-0.5 rounded bg-muted/50">
                        {item.exchange}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-3 truncate">{item.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto pl-3 shrink-0">
                      {providers.find((p) => p.id === item.providerId)?.name ?? item.providerId}
                    </span>
                  </button>
                ))}
                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <div
                    ref={sentinelRef}
                    className="flex items-center justify-center py-3 text-xs text-muted-foreground font-mono"
                  >
                    {loadingMore ? 'Loading more...' : ''}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

SymbolSelector.displayName = 'SymbolSelector'
