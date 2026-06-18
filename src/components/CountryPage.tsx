import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
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
      .slice(0, 8)
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

  const sidebarContent = (
    <>
      {/* Year chart */}
      {yearTotals.length > 1 && (
        <div className="px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600">By Year</div>
            {hoveredYear !== null && (
              <div className="text-[10px] font-mono text-zinc-400">
                {hoveredYear} · {formatCost(yearTotals.find(d => d.year === hoveredYear)?.value ?? 0)}
              </div>
            )}
          </div>
          {/* Bars */}
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
          {/* Year labels */}
          <div className="flex justify-between pt-1">
            <span className="text-[8px] text-zinc-600">{yearTotals[0].year}</span>
            <span className="text-[8px] text-zinc-600">{yearTotals[yearTotals.length - 1].year}</span>
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div className="px-5 py-4 border-b border-zinc-800">
        <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">By Category</div>
        <div className="space-y-1.5">
          {presentCategories.map(cat => {
            const data = categoryTotals.get(cat)!
            const pct = (data.cost / maxCatCost) * 100
            const isActive = activeCategory === cat
            const color = CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(isActive ? null : cat)
                  setSidebarOpen(false)
                }}
                className={`w-full text-left transition-opacity ${
                  activeCategory && !isActive ? 'opacity-30 hover:opacity-60' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 flex-shrink-0 rounded-sm" style={{ background: color }} />
                    <span className="text-[10px] uppercase tracking-wide text-zinc-400">{cat}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">{formatCost(data.cost)}</span>
                </div>
                <div className="h-px bg-zinc-800 w-full relative overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 h-full"
                    style={{ background: color, opacity: 0.5 }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </button>
            )
          })}
          {activeCategory && (
            <button
              onClick={() => { setActiveCategory(null); setSidebarOpen(false) }}
              className="text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
            >
              ✕ Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Contractor breakdown */}
      {contractorTotals.length > 0 && (
        <div className="px-5 py-4">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-3">By Contractor</div>
          <div className="space-y-3">
            {contractorTotals.map(([name, data]) => {
              const pct = (data.cost / maxContractorCost) * 100
              const logoUrl = getContractorLogoUrl(name)
              const isActive = activeContractor === name
              return (
                <button
                  key={name}
                  onClick={() => {
                    setActiveContractor(isActive ? null : name)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left transition-opacity ${
                    activeContractor && !isActive ? 'opacity-30 hover:opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt={name}
                        className="w-4 h-4 object-contain flex-shrink-0 opacity-70"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <span className="text-[10px] text-zinc-400 truncate flex-1">{name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">{formatCost(data.cost)}</span>
                  </div>
                  <div className="h-px bg-zinc-800 w-full relative overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 h-full bg-zinc-500 opacity-40"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </button>
              )
            })}
            {activeContractor && (
              <button
                onClick={() => { setActiveContractor(null); setSidebarOpen(false) }}
                className="text-[10px] uppercase tracking-wider text-zinc-600 hover:text-zinc-400 transition-colors pt-1"
              >
                ✕ Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0f0f]">

      {/* Header */}
      <div className="px-4 md:px-8 py-3 md:py-5 border-b border-zinc-800 flex-shrink-0 bg-[#0d0d0d]">
        {/* Top row: back + country + stats */}
        <div className="flex items-center gap-3 md:gap-5">
          <button
            onClick={onBack}
            className="text-zinc-600 hover:text-zinc-300 text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span className="hidden sm:inline">Map</span>
          </button>
          <div className="w-px h-4 bg-zinc-800 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 md:gap-3">
              {getFlagUrl(country) && (
                <img src={getFlagUrl(country)!} alt={country} className="h-4 md:h-5 w-auto flex-shrink-0 opacity-90" />
              )}
              <h1 className="text-base md:text-xl font-normal text-white tracking-tight truncate">{country}</h1>
            </div>
            <p className="text-[9px] md:text-[10px] text-zinc-600 mt-0.5 uppercase tracking-widest hidden sm:block">
              {formatDate(dateMin)} – {formatDate(dateMax)}
            </p>
          </div>
          {/* Stats: always right-aligned */}
          <div className="flex items-center gap-4 md:gap-8 text-right flex-shrink-0">
            <div>
              <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5 md:mb-1">Total Value</div>
              <div className="text-sm md:text-lg font-mono font-normal text-amber-400">{formatCost(totalCost)}</div>
            </div>
            <div className="hidden sm:block">
              <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5 md:mb-1">Notifications</div>
              <div className="text-sm md:text-lg font-mono font-normal text-zinc-300">{notifications.length}</div>
            </div>
          </div>
        </div>
        {/* Mobile: date range + notification count below */}
        <div className="flex items-center justify-between mt-1.5 sm:hidden">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            {formatDate(dateMin)} – {formatDate(dateMax)}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            {notifications.length} notifications
          </p>
        </div>
      </div>

      {/* Body: sidebar + table */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`
          fixed inset-y-0 left-0 z-50 md:relative md:inset-auto
          w-72 flex-shrink-0 border-r border-zinc-800 overflow-y-auto bg-[#0d0d0d]
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex md:flex-col
        `}>
          {/* Mobile close button */}
          <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-zinc-800">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Overview</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-zinc-600 hover:text-zinc-300 text-lg leading-none transition-colors"
            >
              ✕
            </button>
          </div>
          {sidebarContent}
        </div>

        {/* Main table */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* Controls */}
          <div className="px-3 md:px-6 py-2 md:py-2.5 border-b border-zinc-800 flex-shrink-0 bg-[#0d0d0d]">
            <div className="flex items-center gap-2 md:gap-4">
              {/* Mobile filter toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="md:hidden flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 px-2.5 py-1.5 transition-colors flex-shrink-0"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M1 3h10M3 6h6M5 9h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {(activeCategory || activeContractor) ? <span className="text-amber-400">Filtered</span> : 'Overview'}
              </button>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search systems, contractors…"
                className="flex-1 min-w-0 bg-[#0a0a0a] border border-zinc-800 focus:border-zinc-600 text-zinc-300 px-3 py-1.5 text-xs outline-none placeholder:text-zinc-700 transition-colors"
              />
              {search && (
                <button onClick={() => setSearch('')} className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors flex-shrink-0">✕</button>
              )}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[10px] text-zinc-700 uppercase tracking-wider hidden sm:block">Sort</span>
                {(['date', 'cost'] as const).map(s => {
                  const isActive = sort === s
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (isActive) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                        else { setSort(s); setSortDir('desc') }
                      }}
                      className={`flex items-center gap-0.5 text-[10px] uppercase tracking-wider transition-colors ${isActive ? 'text-zinc-300' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      {s === 'date' ? 'Date' : 'Value'}
                      {isActive && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
                          {sortDir === 'desc'
                            ? <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            : <path d="M1 5.5L4 2.5L7 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          }
                        </svg>
                      )}
                    </button>
                  )
                })}
                <span className="text-[10px] text-zinc-700 font-mono">
                  {filtered.length}{filtered.length !== notifications.length ? `/${notifications.length}` : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Table header — desktop only */}
          <div className="hidden md:flex px-6 py-2 border-b border-zinc-800 items-center gap-4 flex-shrink-0 bg-[#0a0a0a]">
            <div className="w-20 flex-shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">Date</div>
            <div className="w-24 flex-shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">Transmittal</div>
            <div className="flex-1 text-[10px] uppercase tracking-widest text-zinc-600">System</div>
            <div className="w-44 flex-shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">Contractor</div>
            <div className="w-24 flex-shrink-0 text-right text-[10px] uppercase tracking-widest text-zinc-600">Value</div>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-zinc-700">
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
                  className={`border-b border-zinc-800/60 transition-colors ${isOpen ? 'bg-zinc-900/40' : 'hover:bg-zinc-900/30'}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut', delay: Math.min(i * 0.03, 0.3) }}
                >

                  {/* Desktop row */}
                  <button
                    className="hidden md:flex w-full text-left px-6 py-3 items-center gap-4"
                    onClick={() => setExpandedIdx(isOpen ? null : i)}
                  >
                    <div className="w-20 flex-shrink-0 text-[11px] font-mono text-zinc-500">{formatDate(n.date)}</div>
                    <div className="w-24 flex-shrink-0 flex items-center gap-1.5">
                      <div className="w-1 h-4 flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] font-mono text-zinc-500">{n.transmittal ?? '—'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-zinc-200 truncate">
                        {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide mt-0.5" style={{ color }}>{cat}</div>
                    </div>
                    <div className="w-44 flex-shrink-0 flex items-center gap-2">
                      {primaryContractor && (
                        <>
                          {getContractorLogoUrl(primaryContractor) && (
                            <img
                              src={getContractorLogoUrl(primaryContractor)!}
                              alt={primaryContractor}
                              className="w-4 h-4 object-contain flex-shrink-0 opacity-70"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <span className="text-xs text-zinc-500 truncate">{primaryContractor}</span>
                        </>
                      )}
                      {!primaryContractor && <span className="text-zinc-700">—</span>}
                    </div>
                    <div className="w-24 flex-shrink-0 text-right">
                      <span className={`text-sm font-mono ${n.costUSD ? 'text-amber-400' : 'text-zinc-700'}`}>
                        {n.costUSD ? formatCost(n.costUSD) : '—'}
                      </span>
                    </div>
                  </button>

                  {/* Mobile / tablet card row */}
                  <button
                    className="md:hidden w-full text-left px-4 py-3"
                    onClick={() => setExpandedIdx(isOpen ? null : i)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-0.5 self-stretch flex-shrink-0 mt-0.5" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-zinc-200 leading-snug line-clamp-2 flex-1 min-w-0">
                            {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                          </div>
                          {n.costUSD && (
                            <span className="text-sm font-mono text-amber-400 flex-shrink-0">{formatCost(n.costUSD)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[10px] font-mono text-zinc-600">{formatDate(n.date)}</span>
                          <span className="text-[10px] uppercase tracking-wide" style={{ color }}>{cat}</span>
                          {primaryContractor && (
                            <span className="text-[10px] text-zinc-600 truncate">{primaryContractor}</span>
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
                            {primaryContractor && getContractorLogoUrl(primaryContractor) && (
                              <img
                                src={getContractorLogoUrl(primaryContractor)!}
                                alt={primaryContractor}
                                className="h-5 object-contain opacity-80"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
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
                          View Source ↗
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
