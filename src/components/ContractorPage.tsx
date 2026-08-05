import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, contractorLogoClassName } from '../utils/contractorLogos'
import { getContractorBlurb } from '../utils/contractorBlurbs'
import { parseContractors, supplyProvider, isSupplyProviderLabel } from '../utils/parseContractors'
import { notificationMatchesQuery } from '../utils/notificationSearch'
import { useCountUp } from '../utils/useCountUp'
import { isNotificationNew } from '../utils/newNotifications'
import { getSystemVisual } from '../utils/systemVisuals'
import { SaleDetailDrawer } from './SaleDetailDrawer'
import { YearTrendChart } from './YearTrendChart'

interface Props {
  contractor: string
  notifications: Notification[]
  initialSaleKey?: string | null
  onSaleKeyChange?: (key: string | null) => void
  onSelectCountry: (country: string) => void
  onSelectContractor?: (contractor: string) => void
  onBack: () => void
}

const TABLE_GRID = '7rem 6rem minmax(0, 28rem) 1fr minmax(0, 17rem) 6.5rem'

function saleUrlKey(n: Notification): string {
  if (n.transmittal) return n.transmittal
  return `${n.date}_${n.costUSD ?? 0}`
}

function findSale(notifications: Notification[], key: string | null | undefined): Notification | null {
  if (!key) return null
  return notifications.find(n => saleUrlKey(n) === key) ?? null
}

export function ContractorPage({
  contractor,
  notifications,
  initialSaleKey = null,
  onSaleKeyChange,
  onSelectCountry,
  onSelectContractor,
  onBack,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<WeaponCategory | null>(null)
  const [activeCountry, setActiveCountry] = useState<string | null>(null)
  const [sort, setSort] = useState<'date' | 'cost'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [layout, setLayout] = useState<'cards' | 'rows'>('rows')
  const [selectedSale, setSelectedSale] = useState<Notification | null>(() =>
    findSale(notifications, initialSaleKey),
  )
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSelectedSale(findSale(notifications, initialSaleKey))
  }, [notifications, initialSaleKey])

  useEffect(() => {
    setActiveCategory(null)
    setActiveCountry(null)
    setSearch('')
  }, [contractor])

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
  const logoUrl = getContractorLogoUrl(contractor)

  const categoryTotals = useMemo(() => {
    const map = new Map<WeaponCategory, { cost: number; count: number }>()
    for (const n of notifications) {
      const cat = categorize(n.system)
      const prev = map.get(cat) ?? { cost: 0, count: 0 }
      map.set(cat, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return map
  }, [notifications])

  const countryTotals = useMemo(() => {
    const map = new Map<string, { cost: number; count: number }>()
    for (const n of notifications) {
      if (!n.country) continue
      const prev = map.get(n.country) ?? { cost: 0, count: 0 }
      map.set(n.country, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost)
  }, [notifications])

  const yearTotals = useMemo(() => {
    const map = new Map<number, number>()
    for (const n of notifications) {
      const year = parseInt(n.date.slice(0, 4))
      if (!isNaN(year)) map.set(year, (map.get(year) ?? 0) + (n.costUSD ?? 0))
    }
    const years = [...map.keys()].sort()
    if (years.length === 0) return []
    const endYear = Math.max(years[years.length - 1], new Date().getFullYear())
    const result = []
    for (let y = years[0]; y <= endYear; y++) {
      result.push({ year: y, value: map.get(y) ?? 0 })
    }
    return result
  }, [notifications])

  const presentCategories = ALL_CATEGORIES
    .filter(cat => categoryTotals.has(cat))
    .sort((a, b) => categoryTotals.get(b)!.cost - categoryTotals.get(a)!.cost)
  const barDenom = totalCost > 0 ? totalCost : 1

  const filtered = useMemo(() => {
    return notifications
      .filter(n => {
        if (activeCategory && categorize(n.system) !== activeCategory) return false
        if (activeCountry && n.country !== activeCountry) return false
        if (search) {
          return notificationMatchesQuery(n, search, { includeCountry: true, includeContractor: false })
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
  }, [notifications, activeCategory, activeCountry, sort, sortDir, search])

  const activeFilters = (activeCategory ? 1 : 0) + (activeCountry ? 1 : 0)
  const contractorBlurb = getContractorBlurb(contractor)

  const sidebarContent = (
    <div className="flex flex-col">
      {contractorBlurb && (
        <div className="px-5 pt-3 pb-4 md:pt-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2.5">Overview</div>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{contractorBlurb}</p>
        </div>
      )}

      {yearTotals.length >= 2 && (
        <div className="px-5 pt-4 pb-4">
          <YearTrendChart yearTotals={yearTotals} embedded />
        </div>
      )}

      <div className="px-5 pt-4 pb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-600">By Category</span>
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
            const pct = (data.cost / barDenom) * 100
            const isActive = activeCategory === cat
            const isDimmed = activeCategory && !isActive
            const color = CATEGORY_COLORS[cat]
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(isActive ? null : cat); setSidebarOpen(false) }}
                className={`w-full text-left group transition-opacity ${isDimmed ? 'opacity-25 hover:opacity-60' : ''}`}
              >
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-[12px] text-zinc-400 group-hover:text-zinc-200 transition-colors truncate">{cat}</span>
                  </div>
                  <span className="text-[12px] font-mono text-zinc-500 flex-shrink-0 tabular-nums">
                    {formatCost(data.cost)}
                  </span>
                </div>
                <div className="h-[3px] bg-zinc-800/80 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ background: color, width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {countryTotals.length > 0 && (
        <div className="px-5 pt-4 pb-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-600">By Country</span>
            {activeCountry && (
              <button
                onClick={() => setActiveCountry(null)}
                className="text-[9px] uppercase tracking-wider text-amber-600 hover:text-amber-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-3">
            {countryTotals.map(([name, data]) => {
              const pct = (data.cost / barDenom) * 100
              const flagUrl = getFlagUrl(name)
              const isActive = activeCountry === name
              const isDimmed = activeCountry && !isActive
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setActiveCountry(isActive ? null : name)
                    setSidebarOpen(false)
                  }}
                  className={`w-full text-left group transition-opacity ${isDimmed ? 'opacity-25 hover:opacity-60' : ''}`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {flagUrl && (
                      <img
                        src={flagUrl}
                        alt=""
                        className="w-4 h-3 object-cover flex-shrink-0 opacity-70 rounded-sm"
                        decoding="async"
                      />
                    )}
                    <span className={`text-[12px] truncate flex-1 transition-colors ${
                      isActive ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-200'
                    }`}>{name}</span>
                    <span className="text-[12px] font-mono text-zinc-500 flex-shrink-0 tabular-nums">
                      {formatCost(data.cost)}
                    </span>
                  </div>
                  <div className="h-[3px] bg-zinc-800/80 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isActive ? 'bg-amber-600' : 'bg-zinc-500'}`}
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
    <div className="flex flex-col h-full overflow-hidden bg-[#080808]">

      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 pt-4 pb-3">
        <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 md:px-6 py-4 flex items-center gap-4 md:gap-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M6.5 2L3.5 5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[10px] uppercase tracking-widest hidden sm:block">Back</span>
          </button>

          <div className="w-px h-8 bg-zinc-800 flex-shrink-0" />

          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className={`h-8 md:h-9 w-auto flex-shrink-0 object-contain opacity-90 ${contractorLogoClassName(contractor)}`}
                decoding="async"
                fetchPriority="high"
                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
              />
            )}
            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-light text-white tracking-tight leading-none truncate">{contractor}</h1>
              <p className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1 hidden sm:block">
                {dateMin && dateMax ? `${formatDate(dateMin)} – ${formatDate(dateMax)}` : 'Contractor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5 md:gap-8 flex-shrink-0">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Total Value</div>
              <div className="text-lg md:text-xl font-mono font-light text-amber-400 leading-none">{formatCost(animatedTotalCost)}</div>
            </div>
            <div className="hidden sm:block text-right">
              <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Notifications</div>
              <div className="text-lg md:text-xl font-mono font-light text-zinc-300 leading-none">{Math.round(animatedNotifCount).toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 pt-2 sm:hidden">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            {dateMin && dateMax ? `${formatDate(dateMin)} – ${formatDate(dateMax)}` : '—'}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{Math.round(animatedNotifCount).toLocaleString()} notifications</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden relative px-4 md:px-6 pb-4 gap-3 md:gap-4">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <div className={`
          fixed inset-y-3 left-3 z-50 md:relative md:inset-auto
          w-[min(22rem,calc(100vw-1.5rem))] md:w-96 flex-shrink-0 overflow-y-auto
          rounded-xl border border-zinc-800/80 bg-[#111111]
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden
          transition-transform duration-200 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-[120%]'}
          md:translate-x-0 md:flex md:flex-col
        `}>
          <div className="md:hidden flex items-center justify-end px-4 pt-4 pb-1">
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-full bg-black/40 text-zinc-400 hover:text-zinc-100 hover:bg-black/60 transition-colors"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {sidebarContent}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-w-0 rounded-xl border border-zinc-800/80 bg-[#111111]">
          <div className="pl-3 pr-4 md:pl-4 md:pr-5 py-2.5 border-b border-zinc-800/60 flex-shrink-0 flex flex-col gap-2">
            <div className="md:hidden relative w-full">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search systems, months, countries…"
                className="w-full h-9 rounded-lg bg-[#0a0a0a] border border-zinc-800 focus:border-zinc-600 text-zinc-300 pl-8 pr-8 text-xs outline-none placeholder:text-zinc-700 transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 md:gap-3 w-full">
              <button
                onClick={() => setSidebarOpen(true)}
                className={`md:hidden flex items-center justify-center gap-1.5 h-9 text-[10px] uppercase tracking-widest border rounded-lg px-2.5 flex-1 min-w-0 transition-colors ${
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

              <div className="hidden md:block flex-1 relative min-w-0">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none">
                  <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search systems, months, countries…"
                  className="w-full h-9 rounded-lg bg-[#0a0a0a] border border-zinc-800 focus:border-zinc-600 text-zinc-300 pl-8 pr-8 text-xs outline-none placeholder:text-zinc-700 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 1l6 6M7 1L1 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-0.5 border border-zinc-800 rounded-lg p-0.5 flex-none md:flex-initial h-9 overflow-hidden">
                {([
                  { id: 'rows' as const, label: 'Rows', icon: (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M1.5 3h9M1.5 6h9M1.5 9h9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  )},
                  { id: 'cards' as const, label: 'Pics', icon: (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="1.5" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/><rect x="7" y="1.5" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/><rect x="1.5" y="7" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/><rect x="7" y="7" width="3.5" height="3.5" rx="0.6" stroke="currentColor" strokeWidth="1.1"/></svg>
                  )},
                ]).map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-label={opt.label}
                    title={opt.label}
                    onClick={() => setLayout(opt.id)}
                    className={`flex items-center justify-center px-2.5 h-full rounded-md transition-colors ${
                      layout === opt.id ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                    }`}
                  >
                    {opt.icon}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-0.5 border border-zinc-800 rounded-lg p-0.5 flex-[1.35] md:flex-initial min-w-0 h-9 overflow-hidden">
                {(['date', 'cost'] as const).map(s => {
                  const isActive = sort === s
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        if (isActive) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
                        else { setSort(s); setSortDir('desc') }
                      }}
                      className={`flex flex-1 md:flex-initial items-center justify-center gap-1 px-2.5 h-full min-w-0 rounded-md text-[10px] uppercase tracking-wider transition-colors ${
                        isActive ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {s === 'date' ? 'Date' : 'Value'}
                      {isActive && (
                        <svg width="7" height="7" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
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
          </div>

          <div
            className={`flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${layout === 'cards' ? 'p-3 md:p-4' : ''}`}
          >
            {filtered.length === 0 && (
              <div className="flex items-center justify-center h-32 text-xs text-zinc-700">
                No notifications match current filters
              </div>
            )}

            {layout === 'rows' ? (
              <>
                <div
                  className="hidden xl:grid sticky top-0 z-10 px-6 py-2 border-b border-zinc-800/60 bg-[#111111] gap-4 items-center"
                  style={{ gridTemplateColumns: TABLE_GRID }}
                >
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium">Date</div>
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium">ID #</div>
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium">System</div>
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium">Contractor/Provider</div>
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium">Country</div>
                  <div className="min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium text-right">Value</div>
                </div>
                {filtered.map((n, i) => {
                  const cat = categorize(n.system)
                  const color = CATEGORY_COLORS[cat]
                  const isSelected = selectedSale === n
                  const isNew = isNotificationNew(n)
                  const contractors = parseContractors(n.contractor, n.contractorLocation)
                  const provider = supplyProvider(n.contractor)
                  const primaryContractor = contractors[0]?.name ?? null
                  const contractorLabel = contractors.map(c => c.name).join(' · ') || provider || null

                  return (
                    <motion.div
                      key={saleUrlKey(n)}
                      className={`border-b border-zinc-800/40 transition-colors ${isSelected ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/25'}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.18) }}
                    >
                      <button
                        type="button"
                        className="hidden xl:grid w-full text-left px-6 py-3.5 items-center gap-4"
                        style={{ gridTemplateColumns: TABLE_GRID }}
                        onClick={() => openSale(isSelected ? null : n)}
                      >
                        <div className="min-w-0 overflow-hidden text-[11px] font-mono text-zinc-500">{formatDate(n.date)}</div>
                        <div className="min-w-0 overflow-hidden text-[11px] font-mono text-zinc-500 truncate">{n.transmittal ?? '—'}</div>
                        <div className="min-w-0 overflow-hidden">
                          <div className="text-[12px] text-zinc-200 truncate leading-snug flex items-center gap-2">
                            <span className="truncate">
                              {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                            </span>
                            {isNew && (
                              <span className="shrink-0 px-1.5 py-px rounded-md text-[8px] font-medium uppercase tracking-widest border border-emerald-500/25 bg-emerald-500/15 text-emerald-400">
                                New
                              </span>
                            )}
                          </div>
                          <div className="text-[9px] uppercase tracking-wider mt-0.5 font-medium truncate" style={{ color }}>{cat}</div>
                        </div>
                        <div className="min-w-0 overflow-hidden flex items-center gap-2">
                          {contractorLabel ? (
                            primaryContractor && onSelectContractor ? (
                              <span
                                role="link"
                                tabIndex={0}
                                title={contractorLabel}
                                className="text-[11px] text-zinc-500 truncate hover:text-zinc-300 transition-colors"
                                onClick={e => {
                                  e.stopPropagation()
                                  onSelectContractor(primaryContractor)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onSelectContractor(primaryContractor)
                                  }
                                }}
                              >
                                {contractorLabel}
                              </span>
                            ) : (
                              <span title={contractorLabel ?? undefined} className="text-[11px] text-zinc-500 truncate">{contractorLabel}</span>
                            )
                          ) : (
                            <span className="text-zinc-800">—</span>
                          )}
                        </div>
                        <div className="min-w-0 overflow-hidden">
                          {n.country ? (
                            <span
                              role="link"
                              tabIndex={0}
                              className="text-[11px] text-zinc-500 truncate block hover:text-zinc-300 transition-colors"
                              onClick={e => {
                                e.stopPropagation()
                                onSelectCountry(n.country!)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onSelectCountry(n.country!)
                                }
                              }}
                            >
                              {n.country}
                            </span>
                          ) : (
                            <span className="text-[11px] text-zinc-800">—</span>
                          )}
                        </div>
                        <div className="min-w-0 overflow-hidden text-right">
                          <span className={`text-sm font-mono font-light ${n.costUSD ? 'text-amber-400' : 'text-zinc-800'}`}>
                            {n.costUSD ? formatCost(n.costUSD) : '—'}
                          </span>
                        </div>
                      </button>

                      <button
                        type="button"
                        className="xl:hidden w-full text-left px-4 py-3.5"
                        onClick={() => openSale(isSelected ? null : n)}
                      >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="text-[12px] text-zinc-200 leading-snug line-clamp-2 flex-1 min-w-0 flex items-start gap-2">
                                <span className="line-clamp-2">
                              {n.system ?? <span className="text-zinc-600 italic">Not specified</span>}
                            </span>
                                {isNew && (
                                  <span className="shrink-0 px-1.5 py-px rounded-md text-[8px] font-medium uppercase tracking-widest border border-emerald-500/25 bg-emerald-500/15 text-emerald-400">
                                    New
                                  </span>
                                )}
                              </div>
                              {n.costUSD && (
                                <span className="text-sm font-mono font-light text-amber-400 flex-shrink-0">{formatCost(n.costUSD)}</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[10px] font-mono text-zinc-600 min-w-0">
                              <span className="flex-shrink-0">{formatDate(n.date)}</span>
                              {n.transmittal && (
                                <>
                                  <span className="text-zinc-700 flex-shrink-0">·</span>
                                  <span className="flex-shrink-0">{n.transmittal}</span>
                                </>
                              )}
                              {n.country && (
                                <>
                                  <span className="text-zinc-700 flex-shrink-0">·</span>
                                  <span className="truncate">{n.country}</span>
                                </>
                              )}
                            </div>
                          </div>
                      </button>
                    </motion.div>
                  )
                })}
              </>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((n, i) => {
                const cat = categorize(n.system)
                const color = CATEGORY_COLORS[cat]
                const isSelected = selectedSale === n
                const isNew = isNotificationNew(n)
                const contractors = parseContractors(n.contractor, n.contractorLocation)
                const provider = supplyProvider(n.contractor)
                const logoEntries = [
                  ...contractors.map(c => c.name),
                  ...(provider ? [provider] : []),
                ]
                  .map(name => ({ name, url: getContractorLogoUrl(name) }))
                  .filter((e): e is { name: string; url: string } => !!e.url)
                  .filter((e, i, arr) => arr.findIndex(x => x.url === e.url) === i)
                const visual = getSystemVisual(n.system)
                const flagUrl = n.country ? getFlagUrl(n.country) : null

                return (
                  <motion.button
                    key={saleUrlKey(n)}
                    type="button"
                    onClick={() => openSale(isSelected ? null : n)}
                    className={`group relative flex h-full flex-col text-left overflow-hidden rounded-xl border p-0 transition-colors ${
                      isSelected
                        ? 'border-amber-700/50 bg-[#161616] ring-1 ring-amber-700/20'
                        : 'border-zinc-800/80 bg-[#0c0c0c] hover:border-zinc-600 hover:bg-[#101010]'
                    }`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.18) }}
                  >
                    <div
                      className="relative h-28 md:h-32 w-[calc(100%+2px)] -ml-px -mt-px shrink-0 overflow-hidden"
                      style={!visual.imageUrl ? { background: visual.atmosphere } : { backgroundColor: '#0c0c0c' }}
                    >
                      {visual.imageUrl && (
                        <img
                          src={visual.imageUrl}
                          alt=""
                          className="pointer-events-none absolute left-1/2 top-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2 object-cover"
                          style={{ width: '105%', height: '105%', maxWidth: 'none' }}
                          decoding="async"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/35 to-black/20" />
                      {isNew && (
                        <div className="absolute top-2.5 right-3 z-[1]">
                          <span className="rounded-md border border-emerald-500/25 bg-emerald-500/15 px-1.5 py-px text-[8px] font-medium uppercase tracking-widest text-emerald-400">
                            New
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col px-3.5 py-3 min-h-0">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-[13px] text-zinc-100 leading-snug line-clamp-2 min-w-0">
                          {n.system ?? <span className="text-zinc-600 italic">System not specified</span>}
                        </h3>
                        <span className={`text-sm font-mono font-light flex-shrink-0 tabular-nums leading-snug ${n.costUSD ? 'text-amber-400' : 'text-zinc-700'}`}>
                          {n.costUSD ? formatCost(n.costUSD) : '—'}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5 min-w-0 text-[10px] font-mono text-zinc-600">
                        <span className="flex-shrink-0">{formatDate(n.date)}</span>
                        {n.transmittal && (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="truncate">{n.transmittal}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          {logoEntries.map(({ name, url }) => {
                            const img = (
                              <img
                                src={url}
                                alt={name}
                                title={name}
                                className={`w-4 h-4 object-contain rounded-sm opacity-70 ${contractorLogoClassName(name)}`}
                                decoding="async"
                                onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                              />
                            )
                            if (!onSelectContractor || isSupplyProviderLabel(name)) {
                              return <span key={name} className="inline-flex" title={name}>{img}</span>
                            }
                            return (
                              <span
                                key={name}
                                role="link"
                                tabIndex={0}
                                className="inline-flex hover:opacity-100 opacity-90 transition-opacity"
                                title={name}
                                onClick={e => {
                                  e.stopPropagation()
                                  onSelectContractor(name)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onSelectContractor(name)
                                  }
                                }}
                              >
                                {img}
                              </span>
                            )
                          })}
                          {n.country && (
                            <span className="inline-flex items-center gap-1.5 min-w-0">
                              {flagUrl && (
                                <img
                                  src={flagUrl}
                                  alt=""
                                  className="w-4 h-3 object-cover rounded-sm opacity-80"
                                  decoding="async"
                                />
                              )}
                              <span
                                role="link"
                                tabIndex={0}
                                className="text-[11px] text-zinc-500 truncate hover:text-zinc-300 transition-colors"
                                onClick={e => {
                                  e.stopPropagation()
                                  onSelectCountry(n.country!)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onSelectCountry(n.country!)
                                  }
                                }}
                              >
                                {n.country}
                              </span>
                            </span>
                          )}
                        </div>
                        <span
                          className="shrink-0 text-[9px] font-medium uppercase tracking-wider text-right"
                          style={{ color }}
                        >
                          {cat}
                        </span>
                      </div>
                    </div>
                  </motion.button>
                )
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      <SaleDetailDrawer
        notification={selectedSale}
        country={selectedSale?.country ?? ''}
        variant="contractor"
        onClose={() => openSale(null)}
        onSelectCountry={onSelectCountry}
        onSelectContractor={onSelectContractor}
      />
    </div>
  )
}
