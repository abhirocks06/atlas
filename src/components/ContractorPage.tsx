import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, contractorLogoClassName } from '../utils/contractorLogos'
import { getContractorBlurb } from '../utils/contractorBlurbs'
import { useCountUp } from '../utils/useCountUp'
import { isNotificationNew } from '../utils/newNotifications'
import { SaleDetailDrawer } from './SaleDetailDrawer'
import { YearTrendChart } from './YearTrendChart'

interface Props {
  contractor: string
  notifications: Notification[]
  initialSaleKey?: string | null
  onSaleKeyChange?: (key: string | null) => void
  onSelectCountry: (country: string) => void
  onBack: () => void
}

const TABLE_GRID = '7rem 6rem 8rem minmax(0, 1fr) 6.5rem'

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
  onBack,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<WeaponCategory | null>(null)
  const [sort, setSort] = useState<'date' | 'cost'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedSale, setSelectedSale] = useState<Notification | null>(() =>
    findSale(notifications, initialSaleKey),
  )
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
    const result = []
    for (let y = years[0]; y <= years[years.length - 1]; y++) {
      result.push({ year: y, value: map.get(y) ?? 0 })
    }
    return result
  }, [notifications])

  const presentCategories = ALL_CATEGORIES.filter(cat => categoryTotals.has(cat))
  const maxCatCost = Math.max(...[...categoryTotals.values()].map(v => v.cost), 1)
  const maxCountryCost = countryTotals[0]?.[1].cost ?? 1

  const filtered = useMemo(() => {
    return notifications
      .filter(n => {
        if (activeCategory && categorize(n.system) !== activeCategory) return false
        if (search) {
          const q = search.toLowerCase()
          return (
            n.system?.toLowerCase().includes(q) ||
            n.country?.toLowerCase().includes(q) ||
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
  }, [notifications, activeCategory, sort, sortDir, search])

  const activeFilters = activeCategory ? 1 : 0
  const contractorBlurb = getContractorBlurb(contractor)

  const sidebarContent = (
    <div className="flex flex-col gap-0">
      {contractorBlurb && (
        <div className="px-5 pt-5 pb-4 border-b border-zinc-800/60">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2.5">Overview</div>
          <p className="text-[12px] text-zinc-400 leading-relaxed">{contractorBlurb}</p>
        </div>
      )}

      <YearTrendChart yearTotals={yearTotals} />

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
            <span className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 font-medium">By Country</span>
          </div>
          <div className="space-y-3">
            {countryTotals.map(([name, data]) => {
              const pct = (data.cost / maxCountryCost) * 100
              const flagUrl = getFlagUrl(name)
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onSelectCountry(name)}
                  className="w-full text-left group"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    {flagUrl && (
                      <img
                        src={flagUrl}
                        alt=""
                        className="w-4 h-3 object-cover flex-shrink-0 opacity-70"
                        decoding="async"
                      />
                    )}
                    <span className="text-[10px] text-zinc-400 truncate flex-1 group-hover:text-zinc-200 transition-colors">{name}</span>
                    <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0">{formatCost(data.cost)}</span>
                  </div>
                  <div className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-500" style={{ width: `${pct}%` }} />
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
      <div className="flex-shrink-0 bg-[#0d0d0d] border-b border-zinc-800">
        <div className="px-5 md:px-8 py-4 md:py-5 flex items-center gap-4 md:gap-6">
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

          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            {logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className={`h-6 md:h-7 w-auto flex-shrink-0 object-contain opacity-80 ${contractorLogoClassName(contractor)}`}
                decoding="async"
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

        <div className="flex items-center justify-between px-5 pb-3 sm:hidden">
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">
            {dateMin && dateMax ? `${formatDate(dateMin)} – ${formatDate(dateMax)}` : '—'}
          </p>
          <p className="text-[9px] text-zinc-600 uppercase tracking-widest">{Math.round(animatedNotifCount).toLocaleString()} notifications</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/70 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

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

        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          <div className="pl-3 pr-4 md:pl-4 md:pr-6 py-2.5 border-b border-zinc-800/60 flex-shrink-0 bg-[#0d0d0d] flex items-center gap-3">
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

            <div className="flex-1 relative">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-700 pointer-events-none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search systems, countries, transmittals…"
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

          <div className="hidden xl:grid px-6 py-2 border-b border-zinc-800/60 flex-shrink-0 bg-[#0a0a0a]"
               style={{ gridTemplateColumns: TABLE_GRID }}>
            {['Date', 'Transmittal', 'Country', 'System', 'Value'].map(h => (
              <div key={h} className={`min-w-0 overflow-hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 font-medium ${h === 'Value' ? 'text-right' : ''}`}>{h}</div>
            ))}
          </div>

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
              const flagUrl = n.country ? getFlagUrl(n.country) : null

              return (
                <motion.div
                  key={i}
                  className={`border-b border-zinc-800/40 transition-colors ${isSelected ? 'bg-zinc-900/50' : 'hover:bg-zinc-900/25'}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15, delay: Math.min(i * 0.025, 0.25) }}
                >
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
                    <div className="min-w-0 overflow-hidden flex items-center gap-2">
                      {flagUrl && (
                        <img src={flagUrl} alt="" className="w-4 h-3 object-cover flex-shrink-0 opacity-70" />
                      )}
                      <span className="text-[11px] text-zinc-500 truncate">{n.country ?? '—'}</span>
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
                    <div className="min-w-0 overflow-hidden text-right">
                      <span className={`text-sm font-mono font-light ${n.costUSD ? 'text-amber-400' : 'text-zinc-800'}`}>
                        {n.costUSD ? formatCost(n.costUSD) : '—'}
                      </span>
                    </div>
                  </button>

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
                        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-mono text-zinc-600">
                          <span>{formatDate(n.date)}</span>
                          {n.country && <span>· {n.country}</span>}
                        </div>
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
        country={selectedSale?.country ?? ''}
        onClose={() => openSale(null)}
      />
    </div>
  )
}
