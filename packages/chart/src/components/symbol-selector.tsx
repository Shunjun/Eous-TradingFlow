'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  Badge,
  Skeleton,
  Empty,
  EmptyTitle,
  ToggleGroup,
  ToggleGroupItem,
} from '@eous/ui'
import { Search, ChevronDown } from 'lucide-react'
import { useChartStore } from '../hooks/use-chart-store'
import type { SymbolItem } from '../types'

// ── Props ───────────────────────────────────────────────────────────────────

interface SymbolSelectorProps {
  containerRef?: React.RefObject<HTMLElement | null>
}

// ── Component ───────────────────────────────────────────────────────────────

export function SymbolSelector({ containerRef }: SymbolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Read from store
  const symbol = useChartStore((s) => s.symbol)
  const providers = useChartStore((s) => s.providers)
  const symbols = useChartStore((s) => s.symbols)
  const activeProviderId = useChartStore((s) => s.activeProviderId)
  const symbolsLoading = useChartStore((s) => s.symbolsLoading)
  const hasMore = useChartStore((s) => s.hasMore)
  const loadingMore = useChartStore((s) => s.loadingMore)
  const isSearching = useChartStore((s) => s.isSearching)

  // Actions from store
  const setSymbol = useChartStore((s) => s.setSymbol)
  const setActiveProviderId = useChartStore((s) => s.setActiveProviderId)
  const search = useChartStore((s) => s.search)
  const loadMore = useChartStore((s) => s.loadMore)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIndex(-1)
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

  // Scroll-based infinite scroll
  const handleScroll = useCallback(() => {
    if (!hasMore || loadingMore || isSearching) return
    const el = listRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
      loadMore()
    }
  }, [hasMore, loadingMore, isSearching, loadMore])

  const handleSearchChange = useCallback(
    (value: string) => {
      setQuery(value)
      search(value)
    },
    [search],
  )

  const handleSelect = useCallback(
    (item: SymbolItem) => {
      setSymbol(item.symbol)
      setActiveProviderId(item.providerId)
      setOpen(false)
    },
    [setSymbol, setActiveProviderId],
  )

  const handleProviderChange = useCallback(
    (providerId: string) => {
      setActiveProviderId(providerId)
      setQuery('')
    },
    [setActiveProviderId],
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
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        size="xs"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-mono transition-colors',
          'text-foreground hover:bg-muted/50',
        )}
      >
        <span className="font-medium">{symbol ?? 'Select symbol'}</span>
        <ChevronDown size={12} className="text-muted-foreground" />
      </Button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          container={containerRef?.current ?? null}
          noOverlay
          variant="contained"
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
            <div className="border-b border-border px-4 pb-2">
              <ToggleGroup
                type="single"
                value={activeProviderId}
                onValueChange={(next) => {
                  if (next) handleProviderChange(next)
                }}
                variant="default"
                size="sm"
                spacing={1}
              >
                {providers.map((p) => (
                  <ToggleGroupItem
                    key={p.id}
                    value={p.id}
                    className="h-7 rounded px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 data-[state=on]:bg-primary/15 data-[state=on]:text-primary"
                  >
                    {p.name}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}

          {/* Symbol list */}
          <div ref={listRef} onScroll={handleScroll} className="max-h-72 overflow-y-auto">
            {symbolsLoading ? (
              <div className="px-4 py-8 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            ) : symbols.length === 0 ? (
              <Empty className="py-8 border-0">
                <EmptyTitle className="text-xs font-mono">No symbols found</EmptyTitle>
              </Empty>
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
                    <span className="min-w-20 text-xs font-mono font-medium text-foreground">
                      {item.symbol}
                    </span>
                    {item.exchange && (
                      <Badge variant="secondary" className="text-[10px] font-mono ml-2 px-1 py-0.5">
                        {item.exchange}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-3 truncate">{item.name}</span>
                    <span className="text-[9px] font-mono text-muted-foreground ml-auto pl-3 shrink-0">
                      {providers.find((p) => p.id === item.providerId)?.name ?? item.providerId}
                    </span>
                  </button>
                ))}
                {hasMore && loadingMore && (
                  <div className="px-4 py-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
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
