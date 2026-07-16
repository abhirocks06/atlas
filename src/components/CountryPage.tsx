import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl } from '../utils/contractorLogos'
import { parseContractors, contractorNames, supplySource } from '../utils/parseContractors'
import { isNotificationNew } from '../utils/newNotifications'
import { getCountryBlurb } from '../utils/countryBlurbs'
import { useCountUp } from '../utils/useCountUp'
import { SaleDetailDrawer } from './SaleDetailDrawer'

interface Props {
  country: string
  notifications: Notification[]
  initialSaleKey?: string | null
  onSaleKeyChange?: (key: string | null) => void
  onBack: () => void
}

const TABLE_GRID = '7rem 6rem minmax(0, 1fr) minmax(0, 11rem) 6.5rem'

function saleUrlKey(n: Notification): string {
  if (n.transmittal) return n.transmittal
  return `${n.date}_${n.costUSD ?? 0}`
}

function findSale(notifications: Notification[], key: string | null | undefined): Notification | null {
  if (!key) return null
  return notifications.find(n => saleUrlKey(n) === key) ?? null
}

export function CountryPage({ country, notifications, initialSaleKey = null, onSaleKeyChange, onBack }: Props) {
  const [activeCategory, setActiveCategory] = useState<WeaponCategory | null>(null)
  const [activeContractor, setActiveContractor] = useState<string | null>(null)
  const [sort, setSort] = useState<'date' | 'cost'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedSale, setSelectedSale] = useState<Notification | null>(() =>
    findSale(notifications, initialSaleKey),
  )
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  // Keep drawer in sync when notifications list or URL key changes (e.g. refresh / back)
  useEffect(() => {
    setSelectedSale(findSale(notifications, initialSaleKey))
  }, [notifications, initialSaleKey])

  const openSale = (n: Notification | null) => {
    setSelectedSale(n)
    onSaleKeyChange?.(n ? saleUrlKey(n) : null)
  }

  const totalCost = notifications.reduce((s, n) => s + (n.costUSD ?? 0), 0)
  const animatedTotalCost = useCountUp(totalCost)
  const animatedNotifCount = useCountUp(notifications.length)
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
      const names = contractorNames(n.contractor, n.contractorLocation)
      if (names.length === 0) continue
      for (const name of names) {
        const prev = map.get(name) ?? { cost: 0, count: 0 }
        map.set(name, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
      }
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
  const yearChart = useMemo(() => {
    const n = yearTotals.length
    if (n === 0) return null
    const pts = yearTotals.map((d, i) => ({
      year: d.year,
      value: d.value,
      x: n === 1 ? 50 : (i / (n - 1)) * 100,
      y: 100 - (d.value / maxYearValue) * 92 - 4,
    }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},100 L${pts[0].x.toFixed(2)},100 Z`
    return { pts, line, area }
  }, [yearTotals, maxYearValue])
  const presentCategories = ALL_CATEGORIES.filter(cat => categoryTotals.has(cat))
  const maxCatCost = Math.max(...[...categoryTotals.values()].map(v => v.cost), 1)
  const maxContractorCost = contractorTotals[0]?.[1].cost ?? 1

  const filtered = useMemo(() => {
    return notifications
      .filter(n => {
        if (activeCategory && categorize(n.system) !== activeCategory) return false
        if (activeContractor) {
          const names = contractorNames(n.contractor, n.contractorLocation)
          if (!names.includes(activeContractor)) return false
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
  const countryBlurb = getCountryBlurb(country)
  const hoveredYearPt = hoveredYear !== null && yearChart
    ? yearChart.pts.find(p => p.year === hoveredYear) ?? null
    : null

  const sidebarContent = (
    <div className="flex flex-col gap-0">
      {countryBlurb && (
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2.5">Overview</div>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{countryBlurb}</p>
        </div>
      )}

      {/* Year chart */}
      {yearChart && yearTotals.length > 1 && (
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-zinc-600">By Year</div>
            {hoveredYear !== null && (
              <div className="text-[10px] font-mono text-zinc-400">
                {hoveredYear} · {formatCost(yearTotals.find(d => d.year === hoveredYear)?.value ?? 0)}
              </div>
            )}
          </div>
          <div className="relative w-full border-b border-zinc-800" style={{ height: 56 }}>
            <svg
              className="absolute inset-0 w-full h-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d={yearChart.area} fill="#c4873a" fillOpacity="0.1" />
              <path
                d={yearChart.line}
                fill="none"
                stroke="#c4873a"
                strokeWidth="1.75"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                opacity={0.85}
              />
            </svg>
            {hoveredYearPt && (
              <div
                className="absolute w-2 h-2 rounded-full bg-[#e09a45] border border-[#0d0d0d] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[1]"
                style={{ left: `${hoveredYearPt.x}%`, top: `${hoveredYearPt.y}%` }}
              />
            )}
            <div className="absolute inset-0 flex">
              {yearTotals.map(d => (
                <div
                  key={d.year}
                  className="flex-1 h-full cursor-crosshair"
                  onMouseEnter={() => setHoveredYear(d.year)}
                  onMouseLeave={() => setHoveredYear(null)}
                />
              ))}
            </div>
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
                  <div
                    className="h-full rounded-full"
                    style={{ background: color, width: `${pct}%` }}
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
                        decoding="async"
                        loading="eager"
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                    <span className="text-[10px] text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">{name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">{formatCost(data.cost)}</span>
                  </div>
                  <div className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-500"
                      style={{ width: `${pct}%` }}
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
                decoding="async"
                fetchPriority="high"
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
              <div className="text-xl md:text-2xl font-mono font-light text-amber-400 leading-none">{formatCost(animatedTotalCost)}</div>
            </div>
            <div className="w-px bg-zinc-800 hidden sm:block" />
            <div className="text-right hidden sm:block">
              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Notifications</div>
              <div className="text-xl md:text-2xl font-mono font-light text-zinc-300 leading-none">{Math.round(animatedNotifCount).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Mobile date + count */}
        <div className="flex items-center justify-between px-5 pb-3 sm:hidden">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{formatDate(dateMin)} – {formatDate(dateMax)}</p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{Math.round(animatedNotifCount).toLocaleString()} notifications</p>
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
          w-96 flex-shrink-0 border-r border-zinc-800/60 overflow-y-auto bg-[#0d0d0d] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:flex md:flex-col
        `}>
          <div className="md:hidden flex items-center justify-end px-5 py-3 border-b border-zinc-800">
            <button onClick={() => setSidebarOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors" aria-label="Close">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
          </div>
          {sidebarContent}
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">

          {/* Controls bar */}
          <div className="pl-3 pr-4 md:pl-4 md:pr-6 py-2.5 border-b border-zinc-800/60 flex-shrink-0 bg-[#0d0d0d] flex items-center gap-3">
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
                placeholder="Search systems, transmittals…"
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
          <div className="hidden xl:grid px-6 py-2 border-b border-zinc-800/60 flex-shrink-0 bg-[#0a0a0a]"
               style={{ gridTemplateColumns: TABLE_GRID }}>
            {['Date', 'Transmittal', 'System', 'Contractor/Source', 'Value'].map(h => (
              <div key={h} className={`min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium ${h === 'Value' ? 'text-right' : ''}`}>{h}</div>
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
              const isSelected = selectedSale === n
              const isNew = isNotificationNew(n)
              const contractors = parseContractors(n.contractor, n.contractorLocation)
              const source = supplySource(n.contractor)
              const primaryContractor = contractors[0]?.name ?? null
              const contractorLabel = contractors.map(c => c.name).join(' · ') || source || null

              return (
                <motion.div
                  key={i}
                  className={`border-b border-zinc-800/40 transition-colors ${isSelected ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/25'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.025, 0.25) }}
                >
                  {/* Desktop row */}
                  <button
                    className="hidden xl:grid w-full text-left px-6 py-3.5 items-center gap-4"
                    style={{ gridTemplateColumns: TABLE_GRID }}
                    onClick={() => openSale(isSelected ? null : n)}
                  >
                    <div className="min-w-0 overflow-hidden text-[11px] font-mono text-zinc-500">{formatDate(n.date)}</div>
                    <div className="min-w-0 overflow-hidden flex items-center gap-2">
                      <div className="w-[3px] h-4 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-[11px] font-mono text-zinc-500 truncate">{n.transmittal ?? '—'}</span>
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-[12px] text-zinc-200 truncate leading-snug flex items-center gap-2">
                        <span className="truncate">
                          {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                        </span>
                        {isNew && (
                          <span className="shrink-0 px-1.5 py-px rounded text-[8px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                            New
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] uppercase tracking-wider mt-0.5 font-medium truncate" style={{ color }}>{cat}</div>
                    </div>
                    <div className="min-w-0 overflow-hidden flex items-center gap-2">
                      {contractorLabel ? (
                        <>
                          {primaryContractor && getContractorLogoUrl(primaryContractor) && (
                            <img
                              src={getContractorLogoUrl(primaryContractor)!}
                              alt={primaryContractor}
                              className="w-3.5 h-3.5 object-contain flex-shrink-0 opacity-60"
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <span className="text-[11px] text-zinc-500 truncate">{contractorLabel}</span>
                        </>
                      ) : (
                        <span className="text-zinc-800">—</span>
                      )}
                    </div>
                    <div className="min-w-0 overflow-hidden text-right">
                      <span className={`text-sm font-mono font-light ${n.costUSD ? 'text-amber-400' : 'text-zinc-800'}`}>
                        {n.costUSD ? formatCost(n.costUSD) : '—'}
                      </span>
                    </div>
                  </button>

                  {/* Card row (mobile + compressed desktop) */}
                  <button
                    className="xl:hidden w-full text-left px-4 py-3.5"
                    onClick={() => openSale(isSelected ? null : n)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-[3px] self-stretch rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-[12px] text-zinc-200 leading-snug line-clamp-2 flex-1 min-w-0 flex items-start gap-2">
                            <span className="line-clamp-2">
                              {n.system ?? <span className="text-zinc-600 italic">Not specified</span>}
                            </span>
                            {isNew && (
                              <span className="shrink-0 px-1.5 py-px rounded text-[8px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                New
                              </span>
                            )}
                          </div>
                          {n.costUSD && (
                            <span className="text-sm font-mono font-light text-amber-400 flex-shrink-0">{formatCost(n.costUSD)}</span>
                          )}
                        </div>
                        <div className="mt-1.5 text-[10px] font-mono text-zinc-600">{formatDate(n.date)}</div>
                      </div>
                    </div>
                  </button>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      <SaleDetailDrawer
        notification={selectedSale}
        country={country}
        onClose={() => openSale(null)}
      />
    </div>
  )
}
