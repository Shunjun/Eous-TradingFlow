import { useState, useRef, useCallback, useMemo } from 'react'
import {
  cn,
  Dialog,
  DialogTrigger,
  DialogContent,
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

  // ── Reset highlight when results change ───────────────────────
  const resetHighlight = useCallback(() => {
    setHighlightedIndex(-1)
  }, [])

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
            // Clear search first, close on second Escape
            e.preventDefault()
            setSearchQuery('')
          }
          // Let Dialog handle close on second Escape
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
            className={cn('shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>
      </DialogTrigger>

      {/* ── Dialog content ────────────────────────────────── */}
      <DialogContent
        container={containerRef?.current ?? null}
        noOverlay
        className="w-[480px] max-w-[480px] rounded-lg"
        onOpenAutoFocus={handleOpenAutoFocus}
        onKeyDown={handleKeyDown}
      >
        {/* Title */}
        <div className="font-mono text-xs font-medium pb-3">Select Symbol</div>

        {/* ── Row 1: Search ──────────────────────────────── */}
        <div className="relative pb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
          />
          <Input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search symbols..."
            spellCheck={false}
            autoComplete="off"
            className={cn(
              'h-8 pl-8 pr-3 text-xs font-mono',
              'bg-muted/20 border-border',
              'placeholder:text-muted-foreground/40',
            )}
          />
        </div>

        {/* ── Row 2: Provider tabs ───────────────────────── */}
        <div className="flex items-center gap-1.5 pb-2 overflow-x-auto shrink-0">
          {providers.map((provider) => {
            const isActive = provider.id === activeProviderId
            return (
              <button
                key={provider.id}
                onClick={() => onProviderChange(provider.id)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-mono whitespace-nowrap transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                {provider.name}
              </button>
            )
          })}
        </div>

        {/* Divider */}
        <div className="border-t border-border shrink-0" />

        {/* ── Row 3: Symbol list ──────────────────────────── */}
        <div className="max-h-[360px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : filteredSymbols.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-xs text-muted-foreground font-mono">No symbols found</p>
            </div>
          ) : (
            <div className="py-1">
              {filteredSymbols.map((item, index) => {
                const isSelected = item.symbol === symbol
                const isHighlighted = index === highlightedIndex
                const providerName = getProviderName(providers, item.providerId)

                return (
                  <button
                    key={`${item.providerId}-${item.symbol}`}
                    onClick={() => handleSelect(item)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors border-0',
                      'hover:bg-muted/40',
                      isHighlighted && 'bg-muted/40',
                      isSelected && !isHighlighted && 'bg-primary/10',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">
                          {item.symbol}
                        </span>
                        {item.exchange && (
                          <span className="text-[9px] text-muted-foreground/60 font-mono">
                            {item.exchange}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground truncate block leading-tight mt-0.5">
                        {item.name}
                      </span>
                    </div>

                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded font-mono mt-0.5 bg-muted/50 text-muted-foreground">
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
