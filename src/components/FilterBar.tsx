import { useState, useRef, useEffect } from 'react'
import type { WeaponCategory } from '../utils/weaponCategories'

const selectClass =
  'bg-[#0a0a0a] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 text-zinc-400 px-2 py-0.5 md:py-1 text-[11px] md:text-xs outline-none transition-colors cursor-pointer appearance-none pr-5 bg-no-repeat'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2352525b' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundPosition: 'right 6px center',
}

interface Props {
  dateRange: [string, string]
  onDateRangeChange: (range: [string, string]) => void
  minDate: string
  maxDate: string
  categoryFilter: WeaponCategory | null
  onCategoryFilterChange: (cat: WeaponCategory | null) => void
  view: 'map' | 'network'
  onViewChange: (v: 'map' | 'network') => void
  countries: string[]
  onSelectCountry: (country: string) => void
}

export function FilterBar({
  dateRange,
  onDateRangeChange,
  minDate,
  maxDate,
  view,
  onViewChange,
  countries,
  onSelectCountry,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const mobileSearchRef = useRef<HTMLDivElement>(null)
  const desktopSearchRef = useRef<HTMLDivElement>(null)

  const matches = query.length > 0
    ? countries.filter(c => c.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : []

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

  const minYear = parseInt(minDate.slice(0, 4))
  const maxYear = parseInt(maxDate.slice(0, 4))
  const fromYear = parseInt(dateRange[0].slice(0, 4))
  const toYear = parseInt(dateRange[1].slice(0, 4))
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  return (
    <div className="px-3 sm:px-4 md:px-5 py-1.5 md:py-2.5 border-b border-zinc-800 flex-shrink-0 bg-[#0d0d0d]">
      {/* Mobile-only layout */}
      <div className="flex flex-col gap-1 sm:hidden">
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
          <div className="flex items-center gap-0.5 border border-zinc-800 p-0.5 flex-shrink-0 h-8">
            {(['map', 'network'] as const).map(v => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                aria-label={v}
                className={`flex items-center justify-center px-2 h-full transition-colors ${
                  view === v ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                }`}
              >
                {v === 'map' ? (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M1 3.5l4-1.5 4 1.5 4-1.5v9l-4 1.5-4-1.5-4 1.5v-9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 2v9M9 3.5v9" stroke="currentColor" strokeWidth="1.2"/></svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="2.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="2.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/><path d="M4 4h5.5M4 10h5.5M4 4.5L9.5 9.5M4 9.5L9.5 4.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7"/></svg>
                )}
              </button>
            ))}
          </div>
        </div>

        <div ref={mobileSearchRef} className="relative w-full">
          <input
            type="text"
            value={query}
            placeholder="Search country…"
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => { if (query) setOpen(true) }}
            className="w-full h-8 bg-[#0a0a0a] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 text-zinc-300 placeholder-zinc-600 px-2.5 text-xs outline-none transition-colors"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setOpen(false) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 p-1"
              aria-label="Clear"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </button>
          )}
          {open && matches.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#111] border border-zinc-800 shadow-xl z-50 max-h-56 overflow-y-auto">
              {matches.map(c => (
                <button
                  key={c}
                  onMouseDown={() => {
                    setQuery('')
                    setOpen(false)
                    onSelectCountry(c)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors border-b border-zinc-800/60 last:border-0"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop — original layout */}
      <div className="hidden sm:flex items-center flex-wrap gap-x-3 md:gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest">Year</span>
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

        <div className="w-px h-3.5 bg-zinc-800" />

        <div ref={desktopSearchRef} className="relative flex items-center gap-2">
          <span className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest hidden sm:block">Country</span>
          <div className="relative">
            <input
              type="text"
              value={query}
              placeholder="Search…"
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => { if (query) setOpen(true) }}
              className="bg-[#0a0a0a] border border-zinc-800 hover:border-zinc-700 focus:border-zinc-600 text-zinc-300 placeholder-zinc-700 px-2 py-0.5 md:py-1 text-[11px] md:text-xs outline-none transition-colors w-28 md:w-36"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setOpen(false) }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                aria-label="Clear"
              >
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
              </button>
            )}
            {open && matches.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#111] border border-zinc-800 shadow-xl z-50">
                {matches.map(c => (
                  <button
                    key={c}
                    onMouseDown={() => {
                      setQuery('')
                      setOpen(false)
                      onSelectCountry(c)
                    }}
                    className="w-full text-left px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 border border-zinc-800 p-0.5">
          {(['map', 'network'] as const).map(v => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-widest transition-colors ${
                view === v ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              {v === 'map' ? (
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M1 3.5l4-1.5 4 1.5 4-1.5v9l-4 1.5-4-1.5-4 1.5v-9z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 2v9M9 3.5v9" stroke="currentColor" strokeWidth="1.2"/></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><circle cx="2.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="2.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.5" cy="4" r="1.4" stroke="currentColor" strokeWidth="1.1"/><circle cx="11.5" cy="10" r="1.4" stroke="currentColor" strokeWidth="1.1"/><path d="M4 4h5.5M4 10h5.5M4 4.5L9.5 9.5M4 9.5L9.5 4.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.7"/></svg>
              )}
              <span className="hidden sm:inline">{v}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
