import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl } from '../utils/contractorLogos'
import { normalizeContractor } from '../utils/normalizeContractor'

interface Props {
  country: string
  notifications: Notification[]
  onBack: () => void
}

export function CountryPage({ country, notifications, onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState<WeaponCategory | null>(null)
  const [activeContractor, setActiveContractor] = useState<string | null>(null)
  const [sort, setSort] = useState<'date' | 'cost'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  const totalCost = notifications.reduce((s, n) => s + (n.costUSD ?? 0), 0)
  const dates = notifications.map(n => n.date).sort()
  const dateMin = dates[0]
  const dateMax = dates[dates.length - 1]

  const categoryTotals = useMemo(() => {
    const map = new Map<WeaponCategory, { cost: number; count: number }>()
    for (const n of notifications) {
      const cat = categorize(n.system)
      const prev = map.get(cat) ?? { cost: 0, count: 0 }
      map.set(cat, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return map
  }, [notifications])

  const contractorTotals = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>()
    for (const n of notifications) {
      if (!n.contractor) continue
      const raw = n.contractor.split(' / ')[0].trim()
      const name = normalizeContractor(raw)
      const prev = map.get(name) ?? { cost: 0, count: 0 }
      map.set(name, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return [...map.entries()]
      .sort((a, b) => b[1].cost - a[1].cost)
      .slice(0, 6)
  }, [notifications])

  const yearTotals = useMemo(() => {
    const map = new Map<number, number>()
    for (const n of notifications) {
      const year = parseInt(n.date.slice(0, 4))
      if (!isNaN(year)) map.set(year, (map.get(year) ?? 0) + (n.costUSD ?? 0))
    }
    const years = [...map.keys()].sort()
    if (years.length === 0) return []
    const result = []
    for (let y = years[0]; y <= years[years.length - 1]; y++) {
      result.push({ year: y, value: map.get(y) ?? 0 })
    }
    return result
  }, [notifications])

  const maxYearValue = Math.max(...yearTotals.map(d => d.value), 1)
  const presentCategories = ALL_CATEGORIES.filter(cat => categoryTotals.has(cat))
  const maxCatCost = Math.max(...[...categoryTotals.values()].map(v => v.cost), 1)
  const maxContractorCost = contractorTotals[0]?.[1].cost ?? 1

  const filtered = useMemo(() => {
    return notifications
      .filter(n => {
        if (activeCategory && categorize(n.system) !== activeCategory) return false
        if (activeContractor) {
          const raw = n.contractor?.split(' / ')[0].trim() ?? ''
          if (normalizeContractor(raw) !== activeContractor) return false
        }
        if (search) {
          const q = search.toLowerCase()
          return (
            n.system?.toLowerCase().includes(q) ||
            n.contractor?.toLowerCase().includes(q) ||
            n.transmittal?.toLowerCase().includes(q)
          )
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'date') {
          const cmp = a.date.localeCompare(b.date)
          return sortDir === 'desc' ? -cmp : cmp
        }
        const cmp = (a.costUSD ?? 0) - (b.costUSD ?? 0)
        return sortDir === 'desc' ? -cmp : cmp
      })
  }, [notifications, activeCategory, activeContractor, sort, sortDir, search])

  const activeFilters = (activeCategory ? 1 : 0) + (activeContractor ? 1 : 0)

  const sidebarContent = (
    <div className="flex flex-col gap-0">
      {/* Year chart */}
      {yearTotals.length > 1 && (
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600">By Year</div>
            {hoveredYear !== null && (
              <div className="text-[10px] font-mono text-zinc-400">
                {hoveredYear} · {formatCost(yearTotals.find(d => d.year === hoveredYear)?.value ?? 0)}
              </div>
            )}
          </div>
          <div className="flex items-end gap-px border-b border-zinc-800 w-full" style={{ height: 56 }}>
            {yearTotals.map((d) => {
              const pct = (d.value / maxYearValue) * 100
              const isHovered = hoveredYear === d.year
              return (
                <div
                  key={d.year}
                  className="flex-1 h-full flex flex-col justify-end"
                  onMouseEnter={() => setHoveredYear(d.year)}
                  onMouseLeave={() => setHoveredYear(null)}
                >
                  <motion.div
                    className="w-full"
                    style={{
                      background: isHovered ? '#e09a45' : '#c4873a',
                      opacity: d.value > 0 ? (isHovered ? 1 : 0.5) : 0,
                      minHeight: d.value > 0 ? 2 : 0,
                    }}
                    initial={{ height: 0 }}
                    animate={{ height: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              )
            })}
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-[8px] text-zinc-600">{yearTotals[0].year}</span>
            <span className="text-[8px] text-zinc-600">{yearTotals[yearTotals.length - 1].year}</span>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="px-5 pt-4 pb-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 font-medium">By Category</span>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="text-[9px] uppercase tracking-wider text-amber-600 hover:text-amber-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {presentCategories.map(cat => {
            const data = categoryTotals.get(cat)!
            const pct = (data.cost / maxCatCost) * 100
            const isActive = activeCategory === cat
            const isDimmed = activeCategory && !isActive
            const color = CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(isActive ? null : cat); setSidebarOpen(false) }}
                className={`w-full text-left group transition-opacity ${isDimmed ? 'opacity-25 hover:opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[10px] uppercase tracking-wide text-zinc-400 group-hover:text-zinc-200 transition-colors">{cat}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{formatCost(data.cost)}</span>
                </div>
                <div className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Contractor breakdown */}
      {contractorTotals.length > 0 && (
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 font-medium">By Contractor</span>
            {activeContractor && (
              <button
                onClick={() => setActiveContractor(null)}
                className="text-[9px] uppercase tracking-wider text-amber-600 hover:text-amber-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            {contractorTotals.map(([name, data]) => {
              const pct = (data.cost / maxContractorCost) * 100
              const logoUrl = getContractorLogoUrl(name)
              const isActive = activeContractor === name
              const isDimmed = activeContractor && !isActive
              return (
                <button
                  key={name}
                  onClick={() => { setActiveContractor(isActive ? null : name); setSidebarOpen(false) }}
                  className={`w-full text-left group transition-opacity ${isDimmed ? 'opacity-25 hover:opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt={name}
                        className="w-3.5 h-3.5 object-contain flex-shrink-0 opacity-60"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <span className="text-[10px] text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">{name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">{formatCost(data.cost)}</span>
                  </div>
                  <div className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-zinc-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0c0c0c]">

      {/* Header */}
      <div className="flex-shrink-0 bg-[#0d0d0d] border-b border-zinc-800">
        <div className="px-5 md:px-8 py-4 md:py-5 flex items-center gap-4 md:gap-6">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0 group"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest hidden sm:block">Map</span>
          </button>

          <div className="w-px h-8 bg-zinc-800 flex-shrink-0" />

          {/* Country identity */}
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {getFlagUrl(country) && (
              <img
                src={getFlagUrl(country)!}
                alt={country}
                className="h-6 md:h-7 w-auto flex-shrink-0 shadow-sm"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-light text-white tracking-tight leading-none">{country}</h1>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1 hidden sm:block">
                {formatDate(dateMin)} – {formatDate(dateMax)}
              </p>
            </div>
          </div>

          {/* Key stats */}
          <div className="flex items-stretch gap-6 md:gap-10 flex-shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Total Value</div>
              <div className="text-xl md:text-2xl font-mono font-light text-amber-400 leading-none">{formatCost(totalCost)}</div>
            </div>
            <div className="w-px bg-zinc-800 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Notifications</div>
              <div className="text-xl md:text-2xl font-mono font-light text-zinc-300 leading-none">{notifications.length}</div>
            </div>
          </div>
        </div>

        {/* Mobile date + count */}
        <div className="flex items-center justify-between px-5 pb-3 sm:hidden">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{formatDate(dateMin)} – {formatDate(dateMax)}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{notifications.length} notifications</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 md:relative md:inset-auto
          w-72 flex-shrink-0 border-r border-zinc-800/60 overflow-y-auto bg-[#0d0d0d]
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex md:flex-col
        `}>
          <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Overview</span>
            <button onClick={() => setSidebarOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
          </div>
          {sidebarContent}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* Controls bar */}
          <div className="px-4 md:px-6 py-2.5 border-b border-zinc-800/60 flex-shrink-0 bg-[#0d0d0d] flex items-center gap-3">
            {/* Mobile overview toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className={`md:hidden flex items-center gap-1.5 text-[10px] uppercase tracking-widest border px-2.5 py-1.5 flex-shrink-0 transition-colors ${
                activeFilters > 0
                  ? 'border-amber-800 text-amber-500 hover:border-amber-600'
                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600'
              }`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              {activeFilters > 0 ? `${activeFilters} filter${activeFilters > 1 ? 's' : ''}` : 'Overview'}
            </button>

            {/* Search */}
            <div className="flex-1 relative">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search systems, contractors…"
                className="w-full bg-[#0a0a0a] border border-zinc-800 focus:border-zinc-600 text-zinc-300 pl-7 pr-8 py-1.5 text-xs outline-none placeholder:text-zinc-700 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-1 border border-zinc-800 p-0.5 flex-shrink-0">
              {(['date', 'cost'] as const).map(s => {
                const isActive = sort === s
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (isActive) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                      else { setSort(s); setSortDir('desc') }
                    }}
                    className={`flex items-center gap-0.5 px-2 py-1 text-[10px] uppercase tracking-widest transition-colors ${
                      isActive ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {s === 'date' ? 'Date' : 'Value'}
                    {isActive && (
                      <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
                        {sortDir === 'desc'
                          ? <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                          : <path d="M1 5.5L4 2.5L7 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                        }
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

          </div>

          {/* Table header */}
          <div className="hidden md:grid px-6 py-2 border-b border-zinc-800/60 flex-shrink-0 bg-[#0a0a0a]"
               style={{ gridTemplateColumns: '7rem 6rem 1fr 10rem 7rem' }}>
            {['Date', 'Transmittal', 'System', 'Contractor', 'Value'].map(h => (
              <div key={h} className={`text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium ${h === 'Value' ? 'text-right' : ''}`}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto" style={{ scrollbarGutter: 'stable' }}>
            {filtered.length === 0 && (
              <div className="flex items-center justify-center h-32 text-xs text-zinc-700">
                No notifications match current filters
              </div>
            )}
            {filtered.map((n, i) => {
              const cat = categorize(n.system)
              const color = CATEGORY_COLORS[cat]
              const isOpen = expandedIdx === i
              const primaryContractor = n.contractor
                ? normalizeContractor(n.contractor.split(' / ')[0].trim())
                : null

              return (
                <motion.div
                  key={i}
                  className={`border-b border-zinc-800/40 transition-colors ${isOpen ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/25'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.025, 0.25) }}
                >
                  {/* Desktop row */}
                  <button
                    className="hidden md:grid w-full text-left px-6 py-3.5 items-center gap-4"
                    style={{ gridTemplateColumns: '7rem 6rem 1fr 10rem 7rem' }}
                    onClick={() => setExpandedIdx(isOpen ? null : i)}
                  >
                    <div className="text-[11px] font-mono text-zinc-500">{formatDate(n.date)}</div>
                    <div className="flex items-center gap-2">
                      <div className="w-[3px] h-4 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] font-mono text-zinc-500">{n.transmittal ?? '—'}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[12px] text-zinc-200 truncate leading-snug">
                        {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider mt-0.5 font-medium" style={{ color }}>{cat}</div>
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      {primaryContractor ? (
                        <>
                          {getContractorLogoUrl(primaryContractor) && (
                            <img
                              src={getContractorLogoUrl(primaryContractor)!}
                              alt={primaryContractor}
                              className="w-3.5 h-3.5 object-contain flex-shrink-0 opacity-60"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <span className="text-[11px] text-zinc-500 truncate">{primaryContractor}</span>
                        </>
                      ) : (
                        <span className="text-zinc-800">—</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-mono font-light ${n.costUSD ? 'text-amber-400' : 'text-zinc-800'}`}>
                        {n.costUSD ? formatCost(n.costUSD) : '—'}
                      </span>
                    </div>
                  </button>

                  {/* Mobile card row */}
                  <button
                    className="md:hidden w-full text-left px-4 py-3.5"
                    onClick={() => setExpandedIdx(isOpen ? null : i)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[12px] text-zinc-200 leading-snug line-clamp-2 flex-1 min-w-0">
                            {n.system ?? <span className="text-zinc-600 italic">Not specified</span>}
                          </div>
                          {n.costUSD && (
                            <span className="text-sm font-mono font-light text-amber-400 flex-shrink-0">{formatCost(n.costUSD)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-zinc-600">{formatDate(n.date)}</span>
                          <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color }}>{cat}</span>
                          {primaryContractor && (
                            <span className="text-[10px] text-zinc-600">{primaryContractor}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 md:px-6 pb-4 md:pb-5 border-t border-zinc-800/60 bg-[#0a0a0a]">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 pt-4 mb-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Date</div>
                          <div className="text-xs font-mono text-zinc-300">{formatDate(n.date)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Transmittal</div>
                          <div className="text-xs font-mono text-zinc-300">{n.transmittal ?? '—'}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Category</div>
                          <div className="text-xs" style={{ color }}>{cat}</div>
                        </div>
                        {n.costUSD && (
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Estimated Value</div>
                            <div className="text-sm font-mono text-amber-400">{formatCost(n.costUSD)}</div>
                          </div>
                        )}
                      </div>

                      {n.system && (
                        <div className="mb-4">
                          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Equipment / System</div>
                          <div className="text-xs text-zinc-400 leading-relaxed">{n.system}</div>
                        </div>
                      )}

                      {n.contractor && (
                        <div className="mb-4">
                          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-1">Principal Contractor</div>
                          <div className="flex items-center gap-2">
                            <div className="text-xs text-zinc-400">{n.contractor}</div>
                          </div>
                          {n.contractorLocation && (
                            <div className="text-[11px] text-zinc-600 mt-0.5">{n.contractorLocation}</div>
                          )}
                        </div>
                      )}

                      {n.sourceUrl && (
                        <a
                          href={n.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-600 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-3 py-1.5 transition-colors"
                        >
                          View Source
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0" aria-hidden="true">
                            <path d="M6.5 1H9v2.5M9 1 5 5M4 2H2.5A1.5 1.5 0 0 0 1 3.5v5A1.5 1.5 0 0 0 2.5 10h5A1.5 1.5 0 0 0 9 8.5V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </a>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
