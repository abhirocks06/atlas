import type { WeaponCategory } from '../utils/weaponCategories'
import type { Region } from '../utils/countryRegions'
import { ALL_REGIONS } from '../utils/countryRegions'

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
  regionFilter: Region | null
  onRegionFilterChange: (r: Region | null) => void
  view: 'map' | 'network'
  onViewChange: (v: 'map' | 'network') => void
}

export function FilterBar({
  dateRange,
  onDateRangeChange,
  minDate,
  maxDate,
  regionFilter,
  onRegionFilterChange,
  view,
  onViewChange,
}: Props) {
  const minYear = parseInt(minDate.slice(0, 4))
  const maxYear = parseInt(maxDate.slice(0, 4))
  const fromYear = parseInt(dateRange[0].slice(0, 4))
  const toYear = parseInt(dateRange[1].slice(0, 4))

  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  return (
    <div className="px-4 md:px-5 py-2 md:py-2.5 border-b border-zinc-800 flex-shrink-0 bg-[#0d0d0d]">
      <div className="flex items-center flex-wrap gap-x-3 md:gap-x-4 gap-y-1.5">
        {/* View toggle */}
        <div className="flex items-center gap-1 border border-zinc-800 p-0.5">
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

        <div className="w-px h-3.5 bg-zinc-800" />

        {/* Date range — year selectors */}
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

        <div className="w-px h-3.5 bg-zinc-800 hidden sm:block" />

        {/* Region */}
        <div className="flex items-center gap-2">
          <span className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest">Region</span>
          <select
            value={regionFilter ?? ''}
            onChange={e => onRegionFilterChange((e.target.value as Region) || null)}
            className={`${selectClass} ${regionFilter ? 'text-zinc-200 border-zinc-600' : ''}`}
            style={selectStyle}
          >
            <option value="">All regions</option>
            {ALL_REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

      </div>
    </div>
  )
}
