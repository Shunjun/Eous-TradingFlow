import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from '@eous/ui'
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
}: SymbolSelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(-1)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    setHighlightedIndex(-1)
  }, [searchQuery, activeProviderId, symbols.length])

  // ── Focus search input on open ────────────────────────────────
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // ── Click outside to close ────────────────────────────────────
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ── Keyboard navigation ─────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) return

      switch (e.key) {
        case 'Escape': {
          if (searchQuery && !onSearchChange) {
            // Clear search first, close on second Escape
            setSearchQuery('')
          } else {
            setOpen(false)
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
    [open, searchQuery, onSearchChange, filteredSymbols, highlightedIndex],
  )

  // ── Search input change ─────────────────────────────────────
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setSearchQuery(value)
      onSearchChange?.(value)
    },
    [onSearchChange],
  )

  // ── Select a symbol → close popup ──────────────────────────
  const handleSelect = useCallback(
    (item: SymbolItem) => {
      onSymbolSelect(item)
      setOpen(false)
      setSearchQuery('')
    },
    [onSymbolSelect],
  )

  // ── Toggle open ────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) setSearchQuery('')
      return !prev
    })
  }, [])

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* ── Trigger button ─────────────────────────────────── */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
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

      {/* ── Popup panel ────────────────────────────────────── */}
      {open && (
        <div
          ref={popupRef}
          role="dialog"
          aria-label="Select symbol"
          onKeyDown={handleKeyDown}
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'w-[360px] max-h-[440px] flex flex-col',
            'rounded-lg border border-border bg-popover shadow-lg backdrop-blur-sm',
          )}
        >
          {/* ── Row 1: Search ──────────────────────────────── */}
          <div className="relative px-3 pt-3 pb-2">
            <Search
              size={14}
              className="absolute left-[18px] top-1/2 -translate-y-[2px] text-muted-foreground pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search symbols..."
              spellCheck={false}
              autoComplete="off"
              className={cn(
                'w-full h-8 pl-7 pr-3 text-xs font-mono',
                'bg-muted/20 border border-border rounded-md',
                'placeholder:text-muted-foreground/40',
                'focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20',
                'transition-colors',
              )}
            />
          </div>

          {/* ── Row 2: Provider tabs ───────────────────────── */}
          <div className="flex items-center gap-1.5 px-3 pb-2 overflow-x-auto shrink-0">
            {providers.map((provider) => {
              const isActive = provider.id === activeProviderId
              return (
                <button
                  key={provider.id}
                  onClick={() => onProviderChange(provider.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-full text-[10px] font-mono whitespace-nowrap transition-colors',
                    isActive
                      ? 'bg-primary/12 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
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
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={16} className="animate-spin text-muted-foreground" />
              </div>
            ) : filteredSymbols.length === 0 ? (
              <div className="px-3 py-10 text-center">
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
                        'w-full flex items-start gap-3 px-3 py-2 text-left transition-colors border-0',
                        'hover:bg-muted/30',
                        isHighlighted && 'bg-muted/40',
                        isSelected && !isHighlighted && 'bg-primary/[3%]',
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

                      <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded font-mono mt-0.5 bg-muted/40 text-muted-foreground">
                        {providerName}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
