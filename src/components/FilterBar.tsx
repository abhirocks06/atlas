import { useState, useRef, useEffect, useMemo } from 'react'
import type { WeaponCategory } from '../utils/weaponCategories'
import type { NetworkFocus } from './NetworkView'

const selectClass =
  'rounded-lg bg-[#0a0a0a] border border-zinc-800/80 hover:border-zinc-700 focus:border-zinc-600 text-zinc-400 px-2.5 py-0.5 md:py-1 text-[11px] md:text-xs outline-none transition-colors cursor-pointer appearance-none pr-5 bg-no-repeat'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2352525b' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundPosition: 'right 6px center',
}

export type AppView = 'map' | 'network' | 'analytics'

interface Props {
  dateRange: [string, string]
  onDateRangeChange: (range: [string, string]) => void
  minDate: string
  maxDate: string
  categoryFilter: WeaponCategory | null
  onCategoryFilterChange: (cat: WeaponCategory | null) => void
  view: AppView
  onViewChange: (v: AppView) => void
  countries: string[]
  contractors: string[]
  equipment: Array<{ id: string; label: string }>
  onSelectCountry: (country: string) => void
  onSelectContractor: (contractor: string) => void
  onNetworkFocus?: (focus: NetworkFocus) => void
  networkSelection?: string | null
  onClearNetworkFocus?: () => void
  /** Nest inside a rounded panel — no outer bar chrome */
  embedded?: boolean
}

type SearchHit =
  | { name: string; kind: 'country' }
  | { name: string; kind: 'contractor' }
  | { name: string; kind: 'equipment'; systemId: string }

export function FilterBar({
  dateRange,
  onDateRangeChange,
  minDate,
  maxDate,
  view,
  onViewChange,
  countries,
  contractors,
  equipment,
  onSelectCountry,
  onSelectContractor,
  onNetworkFocus,
  networkSelection = null,
  onClearNetworkFocus,
  embedded = false,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const desktopSearchRef = useRef<HTMLDivElement>(null)
  const inputValue = view === 'network' && networkSelection ? networkSelection : query
  const networkSelectionLocked = view === 'network' && Boolean(networkSelection)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as SearchHit[]

    const rank = (name: string) => {
      const al = name.toLowerCase()
      const starts = al.startsWith(q) ? 0 : 1
      return starts
    }

    if (view === 'map' || view === 'analytics') {
      const countryHits: SearchHit[] = countries
        .filter(c => c.toLowerCase().includes(q))
        .map(name => ({ name, kind: 'country' as const }))
      const contractorHits: SearchHit[] = contractors
        .filter(c => c.toLowerCase().includes(q))
        .map(name => ({ name, kind: 'contractor' as const }))

      return [...countryHits, ...contractorHits]
        .sort((a, b) => {
          const rs = rank(a.name) - rank(b.name)
          if (rs !== 0) return rs
          return a.kind === 'country' ? -1 : 1
        })
        .slice(0, 10)
    }

    if (view === 'network') {
      const countryHits: SearchHit[] = countries
        .filter(c => c.toLowerCase().includes(q))
        .map(name => ({ name, kind: 'country' as const }))
      const contractorHits: SearchHit[] = contractors
        .filter(c => c.toLowerCase().includes(q))
        .map(name => ({ name, kind: 'contractor' as const }))
      const equipmentHits: SearchHit[] = equipment
        .filter(e => e.label.toLowerCase().includes(q))
        .map(e => ({ name: e.label, kind: 'equipment' as const, systemId: e.id }))

      return [...equipmentHits, ...countryHits, ...contractorHits]
        .sort((a, b) => {
          const rs = rank(a.name) - rank(b.name)
          if (rs !== 0) return rs
          const kindOrder = { equipment: 0, country: 1, contractor: 2 }
          return kindOrder[a.kind] - kindOrder[b.kind]
        })
        .slice(0, 10)
    }

    return []
  }, [query, countries, contractors, equipment, view])

  // Clear query when switching views so leftover text doesn't confuse
  useEffect(() => {
    setQuery('')
    setOpen(false)
  }, [view])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const t = e.target as Node
      if (!mobileSearchRef.current?.contains(t) && !desktopSearchRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectHit = (hit: SearchHit) => {
    setQuery('')
    setOpen(false)
    if (view === 'map') {
      if (hit.kind === 'contractor') onSelectContractor(hit.name)
      else onSelectCountry(hit.name)
      return
    }
    const focus: NetworkFocus =
      hit.kind === 'equipment'
        ? { type: 'system', id: hit.systemId }
        : hit.kind === 'country'
          ? { type: 'country', name: hit.name }
          : { type: 'contractor', name: hit.name }
    if (view === 'analytics') {
      onNetworkFocus?.(focus)
      onViewChange('network')
      return
    }
    onNetworkFocus?.(focus)
  }

  const submitFirstMatch = () => {
    if (matches.length === 0) return
    selectHit(matches[0]!)
  }

  const clearSearch = () => {
    setQuery('')
    setOpen(false)
    if (view === 'network') onClearNetworkFocus?.()
  }

  const handleInputChange = (value: string) => {
    if (view === 'network' && networkSelection) onClearNetworkFocus?.()
    setQuery(value)
    setOpen(true)
  }

  const minYear = parseInt(minDate.slice(0, 4))
  const maxYear = parseInt(maxDate.slice(0, 4))
  const fromYear = parseInt(dateRange[0].slice(0, 4))
  const toYear = parseInt(dateRange[1].slice(0, 4))
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  const placeholder =
    view === 'network' ? 'Country, contractor, equipment…' : 'Country, contractor…'
  const desktopPlaceholder = placeholder
  const searchInputClass =
    'h-8 w-56 rounded-lg bg-[#0a0a0a] border border-zinc-800/80 hover:border-zinc-700 focus:border-zinc-600 text-zinc-300 placeholder-zinc-700 px-2.5 text-xs outline-none transition-colors'

  const resultsList = (wide: boolean) =>
    open && matches.length > 0 ? (
      <div
        className={`absolute top-full mt-1.5 rounded-lg bg-[#111111] border border-zinc-800/80 shadow-xl z-[100] max-h-56 overflow-y-auto ${
          wide ? 'left-0 right-0' : 'left-0 w-64'
        }`}
      >
        {matches.map(hit => (
          <button
            key={`${hit.kind}-${hit.name}`}
            onMouseDown={() => selectHit(hit)}
            className={`w-full text-left px-3 text-zinc-300 hover:bg-zinc-800/80 hover:text-white transition-colors border-b border-zinc-800/50 last:border-0 truncate flex items-center gap-2 ${
              wide ? 'py-2 text-xs' : 'py-1.5 text-[11px]'
            }`}
          >
            <span className="truncate flex-1">{hit.name}</span>
            {view === 'network' ? (
              <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0">
                {hit.kind === 'contractor' ? 'Co.' : hit.kind === 'equipment' ? 'Equip.' : 'Country'}
              </span>
            ) : (
              <span className="text-[9px] uppercase tracking-wider text-zinc-600 shrink-0">
                {hit.kind === 'contractor' ? 'Co.' : 'Country'}
              </span>
            )}
          </button>
        ))}
      </div>
    ) : null

  const viewToggle = (compact: boolean) => (
    <div className={`flex items-center gap-0.5 border border-zinc-800/80 rounded-lg p-0.5 flex-shrink-0 h-8 ${compact ? '' : 'ml-auto shrink-0'}`}>
      {([
        { id: 'map' as const, label: 'Map' },
        { id: 'network' as const, label: 'Network' },
        { id: 'analytics' as const, label: 'Analytics' },
      ]).map(v => (
        <button
          key={v.id}
          onClick={() => onViewChange(v.id)}
          aria-label={v.label}
          className={`flex items-center ${compact ? 'justify-center px-2' : 'gap-1.5 px-2.5'} h-full rounded-md transition-colors ${
            compact ? '' : 'text-[10px] uppercase tracking-widest'
          } ${
            view === v.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
          }`}
        >
          {v.id === 'map' ? (
            <svg width={compact ? 12 : 11} height={compact ? 12 : 11} viewBox="0 0 14 14" fill="none">
              <path d="M1 3.5l4-1.5 4 1.5 4-1.5v9l-4 1.5-4-1.5-4 1.5v-9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M5 2v9M9 3.5v9" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
          ) : v.id === 'network' ? (
            <svg width={compact ? 12 : 11} height={compact ? 12 : 11} viewBox="0 0 14 14" fill="none">
              <circle cx="2.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="2.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="11.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/>
              <circle cx="11.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/>
              <path d="M4 4h5.5M4 10h5.5M4 4.5L9.5 9.5M4 9.5L9.5 4.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7"/>
            </svg>
          ) : (
            <svg width={compact ? 12 : 11} height={compact ? 12 : 11} viewBox="0 0 14 14" fill="none">
              <path d="M1.5 10.5l2.5-3 2 2 3.5-4.5 2.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M1.5 12h11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          )}
          {!compact && <span>{v.label}</span>}
        </button>
      ))}
    </div>
  )

  return (
    <div className={`flex-shrink-0 ${embedded ? '' : 'px-3 sm:px-4 md:px-5 py-1.5 md:py-2.5 border-b border-zinc-800/80 bg-[#0d0d0d]'}`}>
      <div className={embedded ? 'px-3 sm:px-4 py-2 md:py-2.5' : undefined}>
      {/* Compact layout — phones & tablets */}
      <div className="flex flex-col gap-1.5 lg:hidden">
        <div className="flex items-center gap-1.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 flex-1 min-w-0">
            <select
              aria-label="From year"
              value={fromYear}
              onChange={e => onDateRangeChange([`${e.target.value}-01-01`, dateRange[1]])}
              className={`${selectClass} w-full h-8 py-0 text-xs text-zinc-300`}
              style={selectStyle}
            >
              {years.filter(y => y <= toYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="text-[11px] text-zinc-600 px-0.5">–</span>
            <select
              aria-label="To year"
              value={toYear}
              onChange={e => onDateRangeChange([dateRange[0], `${e.target.value}-12-31`])}
              className={`${selectClass} w-full h-8 py-0 text-xs text-zinc-300`}
              style={selectStyle}
            >
              {years.filter(y => y >= fromYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          {viewToggle(true)}
        </div>

        <div ref={mobileSearchRef} className="relative w-full">
          <input
            type="text"
            value={inputValue}
            placeholder={placeholder}
            readOnly={networkSelectionLocked}
            onChange={e => handleInputChange(e.target.value)}
            onFocus={() => { if (query && !networkSelection) setOpen(true) }}
            onKeyDown={e => { if (e.key === 'Enter') submitFirstMatch() }}
            onMouseDown={e => { if (networkSelectionLocked) e.preventDefault() }}
            onSelect={e => { if (networkSelectionLocked) e.preventDefault() }}
            className={`w-full h-8 rounded-lg bg-[#0a0a0a] border border-zinc-800/80 hover:border-zinc-700 focus:border-zinc-600 text-zinc-300 placeholder-zinc-600 px-2.5 text-xs outline-none transition-colors${networkSelectionLocked ? ' select-none cursor-default' : ''}`}
          />
          {(query || networkSelection) && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 p-1"
              aria-label="Clear"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </button>
          )}
          {resultsList(true)}
        </div>
      </div>

      {/* Wide desktop — single uncrowded row */}
      <div className="hidden lg:flex items-center gap-4">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest">Year</span>
          <select
            value={fromYear}
            onChange={e => onDateRangeChange([`${e.target.value}-01-01`, dateRange[1]])}
            className={selectClass}
            style={selectStyle}
          >
            {years.filter(y => y <= toYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <span className="text-[10px] text-zinc-700">–</span>
          <select
            value={toYear}
            onChange={e => onDateRangeChange([dateRange[0], `${e.target.value}-12-31`])}
            className={selectClass}
            style={selectStyle}
          >
            {years.filter(y => y >= fromYear).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-3.5 bg-zinc-800 shrink-0" />

        <div ref={desktopSearchRef} className="relative flex items-center gap-2 min-w-0">
          <span className="text-[10px] text-zinc-600 uppercase tracking-widest shrink-0">Search</span>
          <div className="relative">
            <input
              type="text"
              value={inputValue}
              placeholder={desktopPlaceholder}
              readOnly={networkSelectionLocked}
              onChange={e => handleInputChange(e.target.value)}
              onFocus={() => { if (query && !networkSelection) setOpen(true) }}
              onKeyDown={e => { if (e.key === 'Enter') submitFirstMatch() }}
              onMouseDown={e => { if (networkSelectionLocked) e.preventDefault() }}
              onSelect={e => { if (networkSelectionLocked) e.preventDefault() }}
              className={`${searchInputClass}${networkSelectionLocked ? ' select-none cursor-default' : ''}`}
            />
            {(query || networkSelection) && (
              <button
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                aria-label="Clear"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </button>
            )}
            {resultsList(false)}
          </div>
        </div>

        {viewToggle(false)}
      </div>
      </div>
    </div>
  )
}
