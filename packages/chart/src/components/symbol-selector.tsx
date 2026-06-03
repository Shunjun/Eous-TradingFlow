import { useState, useRef, useCallback, useMemo } from 'react'
import {
  cn,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from '@eous/ui'
import { Search, ChevronDown, Loader2 } from 'lucide-react'
import type { ProviderOption, SymbolItem } from '../types'

// ── Props ────────────────────────────────────────────────────────────────────

export interface SymbolSelectorProps {
  /** Currently selected symbol code (e.g. "BTC/USDT"). Undefined shows "Select symbol" placeholder. */
  symbol?: string
  /** Available data providers (displayed as filter tabs) */
  providers: ProviderOption[]
  /** Symbol list. If onSearchChange is provided, this shows the parent-filtered results */
  symbols: SymbolItem[]
  /** Currently active provider ID */
  activeProviderId: string
  /** Called when a symbol is selected */
  onSymbolSelect: (item: SymbolItem) => void
  /**
   * Called when search text changes, for async search.
   * If omitted, search is handled client-side.
   */
  onSearchChange?: (query: string) => void
  /** Called when user switches active provider */
  onProviderChange: (providerId: string) => void
  /** Whether the symbol list is loading (async search / provider switch) */
  loading?: boolean
  /** Chart container ref for Dialog portal mounting */
  containerRef?: React.RefObject<HTMLElement | null>
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve provider display name from ID, falling back to the raw ID */
function getProviderName(providers: ProviderOption[], providerId: string): string {
  return providers.find((p) => p.id === providerId)?.name ?? providerId
}

// ── Component ────────────────────────────────────────────────────────────────

export function SymbolSelector({
  symbol,
  providers,
  symbols,
  activeProviderId,
  onSymbolSelect,
  onSearchChange,
  onProviderChange,
  loading = false,
  containerRef,
}: SymbolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)

  // ── Client-side search filter ─────────────────────────────────
  const filteredSymbols = useMemo(() => {
    if (!searchQuery) return symbols
    if (onSearchChange) return symbols // parent handles search, just display

    const q = searchQuery.toLowerCase().trim()
    return symbols.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.exchange ?? '').toLowerCase().includes(q),
    )
  }, [symbols, searchQuery, onSearchChange])

  // ── Focus search input on open ────────────────────────────────
  const handleOpenAutoFocus = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  // ── Close & reset ────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setOpen(false)
    setSearchQuery('')
    setHighlightedIndex(-1)
  }, [])

  // ── Keyboard navigation ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': {
          if (searchQuery && !onSearchChange) {
            e.preventDefault()
            setSearchQuery('')
          }
          break
        }
        case 'ArrowDown': {
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < filteredSymbols.length - 1 ? prev + 1 : 0,
          )
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredSymbols.length - 1,
          )
          break
        }
        case 'Enter': {
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredSymbols.length) {
            handleSelect(filteredSymbols[highlightedIndex])
          }
          break
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, onSearchChange, filteredSymbols, highlightedIndex],
  )

  // ── Search input change ─────────────────────────────────────
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)
      setHighlightedIndex(-1)
      onSearchChange?.(value)
    },
    [onSearchChange],
  )

  // ── Select a symbol → close dialog ──────────────────────────
  const handleSelect = useCallback(
    (item: SymbolItem) => {
      onSymbolSelect(item)
      handleClose()
    },
    [onSymbolSelect, handleClose],
  )

  // ── Render ─────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleClose())}>
      {/* ── Trigger button ─────────────────────────────────── */}
      <DialogTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono tracking-wide transition-colors',
            'text-muted-foreground hover:text-foreground hover:bg-muted/40',
            open && 'bg-muted/40 text-foreground',
          )}
        >
          <span className={cn('truncate max-w-[120px]', !symbol && 'text-muted-foreground')}>
            {symbol || 'Select symbol'}
          </span>
          <ChevronDown
            size={12}
            className={cn('shrink-0 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </DialogTrigger>

      {/* ── Dialog content ────────────────────────────────── */}
      <DialogContent
        container={containerRef?.current ?? null}
        noOverlay
        className="w-[360px] max-w-[360px] max-h-[440px] gap-0"
        onOpenAutoFocus={handleOpenAutoFocus}
        onKeyDown={handleKeyDown}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <DialogHeader>
          <DialogTitle className="font-mono text-xs">Select Symbol</DialogTitle>
        </DialogHeader>

        {/* ── Search ─────────────────────────────────────── */}
        <div className="relative mt-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search symbols..."
            spellCheck={false}
            autoComplete="off"
            className="h-8 pl-9 pr-3 text-[11px] font-mono placeholder:text-[10px] placeholder:text-muted-foreground/60 placeholder:font-mono border-border focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* ── Provider tabs ──────────────────────────────── */}
        <div className="flex gap-1.5 overflow-x-auto mt-3">
          {providers.map((provider) => {
            const isActive = provider.id === activeProviderId
            return (
              <button
                key={provider.id}
                onClick={() => onProviderChange(provider.id)}
                className={cn(
                  'px-2 py-1 text-[10px] font-mono rounded transition-colors shrink-0',
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {provider.name}
              </button>
            )
          })}
        </div>

        {/* ── Symbol list ────────────────────────────────── */}
        <div className="max-h-[320px] overflow-y-auto mt-3">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredSymbols.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <p className="text-[11px] text-muted-foreground font-mono">No symbols found</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredSymbols.map((item, index) => {
                const isSelected = item.symbol === symbol
                const isHighlighted = index === highlightedIndex
                const providerName = getProviderName(providers, item.providerId)

                return (
                  <button
                    key={`${item.providerId}-${item.symbol}`}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 py-2 px-3 text-left rounded-md transition-colors',
                      'hover:bg-muted/60',
                      isHighlighted && 'bg-muted',
                      isSelected && !isHighlighted && 'bg-primary/10',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <span className="text-[11px] font-mono font-medium text-foreground">
                          {item.symbol}
                        </span>
                        {item.exchange && (
                          <span className="text-[9px] uppercase text-muted-foreground/60 ml-1.5">
                            {item.exchange}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate block leading-tight">
                        {item.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground">
                      {providerName}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
