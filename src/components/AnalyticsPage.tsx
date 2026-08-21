import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost } from '../utils/formatters'
import { ALL_REGIONS, REGION_COLORS, regionForCountry, type Region } from '../utils/regions'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, contractorLogoClassName, getContractorInitials } from '../utils/contractorLogos'
import { contractorNames } from '../utils/parseContractors'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'
import { getSystemFamily } from '../utils/systemFamily'
import { YearTrendChart } from './YearTrendChart'

interface Props {
  notifications: Notification[]
  /** Extra top space when sitting under the floating header */
  embedded?: boolean
  /** Measured bottom of floating header (px) — keeps content below the bar */
  headerClearance?: number
}

type ChartMetric = 'value' | 'count'

/** Mobile-only shorter labels for cramped Top Recipients / Top Contractors rows. */
const MOBILE_SHORT_LABELS: Record<string, string> = {
  'United Arab Emirates': 'UAE',
  'The Boeing Company': 'Boeing',
  'Republic of Korea': 'Korea',
  'L3Harris Technologies': 'L3 Harris',
  'RTX Corporation': 'RTX',
}

function LabelWithMobileShort({ name }: { name: string }) {
  const short = MOBILE_SHORT_LABELS[name]
  if (!short) {
    return <span className="text-[11px] text-zinc-300 truncate">{name}</span>
  }
  return (
    <span className="text-[11px] text-zinc-300 truncate">
      <span className="md:hidden">{short}</span>
      <span className="hidden md:inline">{name}</span>
    </span>
  )
}

function totalsByCountry(notifications: Notification[]): Map<string, { value: number; count: number }> {
  const map = new Map<string, { value: number; count: number }>()
  for (const n of notifications) {
    if (!n.country) continue
    const prev = map.get(n.country) ?? { value: 0, count: 0 }
    map.set(n.country, { value: prev.value + (n.costUSD ?? 0), count: prev.count + 1 })
  }
  return map
}

function yearOf(n: Notification): number {
  return parseInt(n.date.slice(0, 4), 10)
}

function avgByCountry(
  notifications: Notification[],
  years: number[],
): Map<string, number> {
  const totals = totalsByCountry(notifications.filter(n => years.includes(yearOf(n))))
  const map = new Map<string, number>()
  const denom = Math.max(years.length, 1)
  for (const [country, data] of totals) {
    map.set(country, data.value / denom)
  }
  return map
}

const CATEGORY_SHORT: Record<WeaponCategory, string> = {
  'Aircraft': 'Aircraft',
  'Missiles & Munitions': 'Missiles',
  'Ground Vehicles & Artillery': 'Ground',
  'Naval Systems': 'Naval',
  'Electronics & Communications': 'Electronics',
  'Sustainment & Support': 'Support',
  'Other': 'Other',
}

type CategoryLeaf = { cat: WeaponCategory; label: string; value: number; share: number }

function hexFill(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function CategoryTreemap({
  items,
  horizontal,
  activeCat,
  onHover,
}: {
  items: CategoryLeaf[]
  horizontal: boolean
  activeCat: WeaponCategory | null
  onHover: (cat: WeaponCategory | null) => void
}) {
  if (items.length === 0) return null
  if (items.length === 1) {
    const item = items[0]
    const dimmed = activeCat != null && activeCat !== item.cat
    const color = CATEGORY_COLORS[item.cat]
    return (
      <div
        className="h-full w-full min-h-0 min-w-0 flex flex-col justify-end px-2 py-1.5 overflow-hidden transition-opacity duration-150"
        style={{
          background: hexFill(color, 0.16 + item.share * 0.28),
          opacity: dimmed ? 0.32 : 1,
        }}
        onMouseEnter={() => onHover(item.cat)}
        onMouseLeave={() => onHover(null)}
      >
        <div className="text-[9px] text-zinc-400 truncate leading-tight">{item.label}</div>
        <div
          className="text-[10px] sm:text-[11px] font-semibold tabular-nums truncate leading-tight mt-0.5"
          style={{ color }}
        >
          {(item.share * 100).toFixed(0)}%
        </div>
      </div>
    )
  }
  const [first, ...rest] = items
  const restValue = rest.reduce((sum, leaf) => sum + leaf.value, 0)
  return (
    <div className={`flex h-full w-full min-h-0 min-w-0 gap-[3px] ${horizontal ? 'flex-row' : 'flex-col'}`}>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flex: first.value }}>
        <CategoryTreemap
          items={[first]}
          horizontal={!horizontal}
          activeCat={activeCat}
          onHover={onHover}
        />
      </div>
      <div className="min-h-0 min-w-0 overflow-hidden" style={{ flex: restValue }}>
        <CategoryTreemap
          items={rest}
          horizontal={!horizontal}
          activeCat={activeCat}
          onHover={onHover}
        />
      </div>
    </div>
  )
}

export function AnalyticsPage({
  notifications,
  embedded = false,
  headerClearance,
}: Props) {
  const years = useMemo(() => {
    const set = new Set<number>()
    for (const n of notifications) {
      const y = yearOf(n)
      if (Number.isFinite(y)) set.add(y)
    }
    return [...set].sort((a, b) => a - b)
  }, [notifications])

  const [metric, setMetric] = useState<ChartMetric>('value')
  const [detailYear, setDetailYear] = useState<number | null>(null)
  const [largestYear, setLargestYear] = useState<number | 'All'>('All')
  const [recipientYear, setRecipientYear] = useState<number | 'All'>('All')
  const [flowYear, setFlowYear] = useState<number | 'All'>('All')
  const [equipmentYear, setEquipmentYear] = useState<number | 'All'>('All')
  const [mutedRegions, setMutedRegions] = useState<Set<Region>>(() => new Set())
  const [hoveredRegionYear, setHoveredRegionYear] = useState<number | null>(null)
  const [hoveredCategory, setHoveredCategory] = useState<WeaponCategory | null>(null)
  /** Grow bars only on first Analytics open — not when switching year pills */
  const [barsIntroDone, setBarsIntroDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setBarsIntroDone(true), 900)
    return () => window.clearTimeout(id)
  }, [])

  // Spacer remount/resize + scroll anchoring can nudge the first card under the
  // floating header after back-nav from a country/contractor link. Snap out of
  // that zone; leave intentional mid-page scroll alone.
  useLayoutEffect(() => {
    if (!embedded) return
    const el = scrollRef.current
    if (!el) return

    const clearance = headerClearance ?? 180
    const fix = () => {
      if (el.scrollTop < clearance + 32) el.scrollTop = 0
    }

    fix()
    const raf = requestAnimationFrame(() => {
      fix()
      requestAnimationFrame(fix)
    })
    const t = window.setTimeout(fix, 80)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(t)
    }
  }, [headerClearance, embedded])

  const yearStats = useMemo(() => {
    const map = new Map<number, { value: number; count: number }>()
    for (const year of years) map.set(year, { value: 0, count: 0 })
    for (const n of notifications) {
      const year = yearOf(n)
      if (!map.has(year)) continue
      const prev = map.get(year)!
      map.set(year, { value: prev.value + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return map
  }, [notifications, years])

  const yearSeries = useMemo(
    () =>
      years.map(year => ({
        year,
        value: metric === 'value'
          ? (yearStats.get(year)?.value ?? 0)
          : (yearStats.get(year)?.count ?? 0),
      })),
    [years, yearStats, metric],
  )

  const detailYearOptions = useMemo(() => years.slice(-6), [years])
  const effectiveDetailYear = detailYear ?? detailYearOptions[detailYearOptions.length - 1] ?? null
  const effectiveLargestYear = largestYear

  const topMovers = useMemo(() => {
    if (effectiveDetailYear == null) {
      return { up: [] as const, down: [] as const }
    }

    const currYears = [effectiveDetailYear - 2, effectiveDetailYear - 1, effectiveDetailYear]
      .filter(y => years.includes(y))
    const prevYears = [effectiveDetailYear - 5, effectiveDetailYear - 4, effectiveDetailYear - 3]
      .filter(y => years.includes(y))
    if (currYears.length === 0 || prevYears.length === 0) {
      return { up: [] as const, down: [] as const }
    }

    const currMap = avgByCountry(notifications, currYears)
    const prevMap = avgByCountry(notifications, prevYears)

    const countries = new Set([...currMap.keys(), ...prevMap.keys()])
    const deltas: { country: string; curr: number; prev: number; delta: number }[] = []
    for (const country of countries) {
      const c = currMap.get(country) ?? 0
      const p = prevMap.get(country) ?? 0
      deltas.push({ country, curr: c, prev: p, delta: c - p })
    }
    const up = [...deltas].filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 10)
    const down = [...deltas].filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 10)
    return { up, down }
  }, [notifications, effectiveDetailYear, years])

  const largestNotifications = useMemo(() => {
    const subset = effectiveLargestYear === 'All'
      ? notifications
      : notifications.filter(n => yearOf(n) === effectiveLargestYear)
    return [...subset]
      .filter(n => n.costUSD != null && n.costUSD > 0)
      .sort((a, b) => (b.costUSD ?? 0) - (a.costUSD ?? 0))
      .slice(0, 10)
  }, [notifications, effectiveLargestYear])

  const regionYearData = useMemo(() => {
    const result = new Map<Region, Map<number, number>>()
    for (const region of ALL_REGIONS) {
      const yearMap = new Map<number, number>()
      for (const year of years) yearMap.set(year, 0)
      result.set(region, yearMap)
    }
    for (const n of notifications) {
      const year = yearOf(n)
      if (!years.includes(year)) continue
      const region = regionForCountry(n.country)
      const yearMap = result.get(region)!
      yearMap.set(year, (yearMap.get(year) ?? 0) + (n.costUSD ?? 0))
    }
    return result
  }, [notifications, years])

  const activeRegions = useMemo(() => {
    return ALL_REGIONS.filter(r => {
      const yearMap = regionYearData.get(r)!
      return [...yearMap.values()].some(v => v > 0)
    })
  }, [regionYearData])

  const visibleRegions = useMemo(
    () => activeRegions.filter(r => !mutedRegions.has(r)),
    [activeRegions, mutedRegions],
  )

  const regionMax = useMemo(() => {
    let max = 1
    const regions = visibleRegions.length > 0 ? visibleRegions : activeRegions
    for (const r of regions) {
      for (const v of regionYearData.get(r)!.values()) max = Math.max(max, v)
    }
    return max
  }, [visibleRegions, activeRegions, regionYearData])

  const regionPaths = useMemo(() => {
    const n = years.length
    if (n < 2) return []
    return activeRegions.map(region => {
      const muted = mutedRegions.has(region)
      const yearMap = regionYearData.get(region)!
      const pts = years.map((year, i) => {
        const v = yearMap.get(year) ?? 0
        const norm = v / regionMax
        return {
          x: (i / (n - 1)) * 100,
          y: 100 - norm * 88 - 6,
        }
      })
      const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
      return { region, line, color: REGION_COLORS[region], muted }
    })
  }, [years, activeRegions, regionYearData, regionMax, mutedRegions])

  const regionHoverPts = useMemo(() => {
    if (hoveredRegionYear == null || years.length < 2) return []
    const i = years.indexOf(hoveredRegionYear)
    if (i < 0) return []
    const x = (i / (years.length - 1)) * 100
    return visibleRegions.map(region => {
      const v = regionYearData.get(region)!.get(hoveredRegionYear) ?? 0
      return {
        region,
        value: v,
        x,
        y: 100 - (v / regionMax) * 88 - 6,
        color: REGION_COLORS[region],
      }
    })
  }, [hoveredRegionYear, years, visibleRegions, regionYearData, regionMax])

  const toggleRegion = (region: Region) => {
    setMutedRegions(prev => {
      const next = new Set(prev)
      if (next.has(region)) next.delete(region)
      else next.add(region)
      const stillVisible = activeRegions.some(r => !next.has(r))
      return stillVisible ? next : new Set()
    })
  }

  const soloRegion = (region: Region) => {
    setMutedRegions(new Set(activeRegions.filter(r => r !== region)))
  }

  const topRecipients = useMemo(() => {
    const subset = recipientYear === 'All'
      ? notifications
      : notifications.filter(n => n.date.startsWith(String(recipientYear)))
    return [...totalsByCountry(subset).entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10)
  }, [notifications, recipientYear])

  const maxRecipientValue = Math.max(...topRecipients.map(([, v]) => v.value), 1)

  const flowSubset = useMemo(() => {
    return flowYear === 'All'
      ? notifications
      : notifications.filter(n => n.date.startsWith(String(flowYear)))
  }, [notifications, flowYear])

  const topContractors = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of flowSubset) {
      if (!n.costUSD) continue
      for (const name of contractorNames(n.contractor, n.contractorLocation)) {
        map.set(name, (map.get(name) ?? 0) + n.costUSD)
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [flowSubset])

  const maxContractorValue = Math.max(...topContractors.map(([, v]) => v), 1)

  const equipmentSubset = useMemo(() => {
    return equipmentYear === 'All'
      ? notifications
      : notifications.filter(n => n.date.startsWith(String(equipmentYear)))
  }, [notifications, equipmentYear])

  const categoryTotals = useMemo(() => {
    const map = new Map<WeaponCategory, number>()
    for (const cat of ALL_CATEGORIES) map.set(cat, 0)
    for (const n of equipmentSubset) {
      const cat = categorize(n.system)
      map.set(cat, (map.get(cat) ?? 0) + (n.costUSD ?? 0))
    }
    return [...map.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
  }, [equipmentSubset])

  const categoryLeaves = useMemo(() => {
    const total = categoryTotals.reduce((sum, [, v]) => sum + v, 0) || 1
    return categoryTotals.map(([cat, value]) => ({
      cat,
      label: CATEGORY_SHORT[cat],
      value,
      share: value / total,
    }))
  }, [categoryTotals])

  useEffect(() => {
    setHoveredCategory(null)
  }, [equipmentYear])

  const activeCategoryLeaf = hoveredCategory
    ? categoryLeaves.find(leaf => leaf.cat === hoveredCategory) ?? null
    : null

  const topSystems = useMemo(() => {
    const map = new Map<string, { label: string; value: number }>()
    for (const n of equipmentSubset) {
      if (!n.costUSD) continue
      const fam = getSystemFamily(n.system)
      const id = fam?.id ?? `raw:${(n.system ?? 'unknown').trim().toLowerCase()}`
      const label = fam?.label ?? (n.system?.trim() || 'Unknown system')
      const prev = map.get(id)
      if (prev) prev.value += n.costUSD
      else map.set(id, { label, value: n.costUSD })
    }
    return [...map.values()]
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [equipmentSubset])

  const maxSystemValue = Math.max(...topSystems.map(s => s.value), 1)

  const formatMetric = (v: number) =>
    metric === 'value' ? formatCost(v) : v.toLocaleString()

  const chartLabelYears = useMemo(() => {
    if (years.length === 0) return [] as number[]
    const step = Math.max(1, Math.ceil(years.length / 8))
    return years.filter((_, i) => i === 0 || i === years.length - 1 || i % step === 0)
  }, [years])

  const yearAxisMarks = (heightClass = 'h-5') => (
    <div className={`relative pt-1.5 mb-2 ${heightClass}`}>
      {chartLabelYears.map(year => {
        const i = years.indexOf(year)
        if (i < 0 || years.length < 2) return null
        const x = (i / (years.length - 1)) * 100
        return (
          <span
            key={year}
            className="absolute text-[8px] text-zinc-600 -translate-x-1/2"
            style={{ left: `${x}%` }}
          >
            {year}
          </span>
        )
      })}
    </div>
  )

  const recipientYearOptions = years

  const yearSelectClass =
    'sm:ml-auto rounded-lg bg-[#0a0a0a] border border-zinc-800/80 hover:border-zinc-700 focus:border-zinc-600 text-zinc-300 px-2.5 py-1 text-[11px] outline-none transition-colors cursor-pointer appearance-none pr-7 bg-no-repeat'

  const yearSelectStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2352525b' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundPosition: 'right 8px center',
  } as const

  const renderBar = (pct: number, i: number) =>
    barsIntroDone ? (
      <div
        className="h-full rounded-sm bg-[#c4873a]"
        style={{ width: `${pct * 100}%`, opacity: 0.85 }}
      />
    ) : (
      <motion.div
        className="h-full rounded-sm bg-[#c4873a] origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{
          duration: 0.7,
          delay: 0.04 + i * 0.045,
          ease: [0.22, 1, 0.36, 1],
        }}
        style={{ width: `${pct * 100}%`, opacity: 0.85 }}
      />
    )

  return (
    <div
      className="flex flex-col h-full overflow-hidden bg-[#0a0c10]"
    >
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto [overflow-anchor:none] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={embedded ? { scrollPaddingTop: headerClearance ?? 180 } : undefined}
      >
        {embedded && (
          <div
            aria-hidden="true"
            className="shrink-0 [overflow-anchor:none]"
            style={{ height: headerClearance ?? 180 }}
          />
        )}
        <div className="px-4 md:px-6 pt-5 pb-10 space-y-5">
          {/* Top Recipients + Top Contractors */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch">
            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">Top Recipients</div>
                <select
                  aria-label="Top recipients year"
                  value={recipientYear === 'All' ? 'All' : String(recipientYear)}
                  onChange={e => {
                    const v = e.target.value
                    setRecipientYear(v === 'All' ? 'All' : parseInt(v, 10))
                  }}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  <option value="All">All years</option>
                  {recipientYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 flex-1">
                {topRecipients.map(([country, data], i) => {
                  const pct = maxRecipientValue > 0 ? data.value / maxRecipientValue : 0
                  const flagUrl = getFlagUrl(country, 40)
                  return (
                    <div key={country} className="flex items-center gap-2 sm:gap-3">
                      <div className="text-[9px] text-zinc-600 tabular-nums w-4 text-right shrink-0">{i + 1}</div>
                      <div className="flex items-center gap-2 w-28 sm:w-40 shrink-0 min-w-0">
                        {flagUrl ? (
                          <img
                            src={flagUrl}
                            alt=""
                            className="w-5 h-3.5 object-cover rounded-[1px] shrink-0 opacity-90"
                            decoding="async"
                          />
                        ) : (
                          <span className="w-5 h-3.5 rounded-[1px] bg-zinc-800 shrink-0" />
                        )}
                        <LabelWithMobileShort name={country} />
                      </div>
                      <div className="flex-1 h-3 bg-zinc-900/80 rounded-sm overflow-hidden min-w-0 pointer-events-none">
                        {renderBar(pct, i)}
                      </div>
                      <div className="text-[11px] font-semibold text-[#c4873a] tabular-nums w-14 sm:w-16 text-right shrink-0">
                        {formatCost(data.value)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">Top Contractors</div>
                <select
                  aria-label="Top contractors year"
                  value={flowYear === 'All' ? 'All' : String(flowYear)}
                  onChange={e => {
                    const v = e.target.value
                    setFlowYear(v === 'All' ? 'All' : parseInt(v, 10))
                  }}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  <option value="All">All years</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2 flex-1">
                {topContractors.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-2">No contractor data for this range.</div>
                ) : (
                  topContractors.map(([name, value], i) => {
                    const pct = maxContractorValue > 0 ? value / maxContractorValue : 0
                    const logo = getContractorLogoUrl(name)
                    return (
                      <div key={name} className="flex items-center gap-2 sm:gap-3">
                        <div className="text-[9px] text-zinc-600 tabular-nums w-4 text-right shrink-0">{i + 1}</div>
                        <div className="flex items-center gap-2 w-28 sm:w-40 shrink-0 min-w-0">
                          {logo ? (
                            <img
                              src={logo}
                              alt=""
                              className={`w-4 h-4 object-contain rounded-sm shrink-0 opacity-80 ${contractorLogoClassName(name)}`}
                              decoding="async"
                            />
                          ) : (
                            <span
                              className="w-4 h-4 rounded-sm bg-zinc-800 shrink-0 flex items-center justify-center text-[7px] font-medium text-zinc-400 leading-none"
                              aria-hidden
                            >
                              {getContractorInitials(name)}
                            </span>
                          )}
                          <LabelWithMobileShort name={name} />
                        </div>
                        <div className="flex-1 h-3 bg-zinc-900/80 rounded-sm overflow-hidden min-w-0 pointer-events-none">
                          {renderBar(pct, i)}
                        </div>
                        <div className="text-[11px] font-semibold text-[#c4873a] tabular-nums w-14 sm:w-16 text-right shrink-0">
                          {formatCost(value)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Value by Year + Value by Region */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col min-h-[220px]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">
                  {metric === 'value' ? 'Value by Year' : 'Count by Year'}
                </div>
                <div className="flex items-center gap-1 sm:ml-auto shrink-0">
                  {(['value', 'count'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMetric(m)}
                      className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-md border transition-colors ${
                        metric === m
                          ? 'border-zinc-600 text-zinc-300 bg-zinc-800/60'
                          : 'border-transparent text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {m === 'value' ? 'Value' : 'Count'}
                    </button>
                  ))}
                </div>
              </div>
              {years.length < 2 ? (
                <div className="text-xs text-zinc-600 py-4">Need at least two years in range.</div>
              ) : (
                <div className="flex-1 flex flex-col justify-end">
                  <YearTrendChart
                    yearTotals={yearSeries}
                    embedded
                    tall
                    formatValue={formatMetric}
                    stroke={metric === 'value' ? '#c4873a' : '#2e7d9b'}
                    fill={metric === 'value' ? '#c4873a' : '#2e7d9b'}
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col min-h-[220px]">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">Value by Region</div>
                <div className="flex items-center gap-1 sm:ml-auto shrink-0">
                  {mutedRegions.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setMutedRegions(new Set())}
                      className="text-[9px] uppercase tracking-widest px-2 py-1 rounded-md border border-transparent text-zinc-600 hover:text-zinc-400"
                    >
                      Show all
                    </button>
                  )}
                </div>
              </div>
              {years.length < 2 ? (
                <div className="text-xs text-zinc-600 py-2">Need more years.</div>
              ) : (
                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex items-baseline justify-start mb-3 min-h-[1.25rem]">
                    {hoveredRegionYear != null ? (
                      <div className="text-[12px] font-mono text-zinc-300 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="text-zinc-500 tabular-nums">{hoveredRegionYear}</span>
                        <span className="text-zinc-600">·</span>
                        {regionHoverPts.map(p => (
                          <span key={p.region} className="tabular-nums" style={{ color: p.color }}>
                            {formatCost(p.value)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="relative w-full h-[100px] border-b border-zinc-800/60">
                    <motion.svg
                      key={`${[...mutedRegions].join(',')}-${regionMax}`}
                      className="absolute inset-0 w-full h-full overflow-visible origin-bottom"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden="true"
                      initial={{ scaleY: 0, opacity: 0.35 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ duration: 0.9, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                    >
                      {regionPaths.filter(p => !p.muted).map(({ region, line, color }) => (
                        <path
                          key={region}
                          d={line}
                          fill="none"
                          stroke={color}
                          strokeWidth={1.75}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          vectorEffect="non-scaling-stroke"
                          opacity={0.9}
                        />
                      ))}
                    </motion.svg>
                    {regionHoverPts.map(p => (
                      <div
                        key={p.region}
                        className="absolute w-2 h-2 rounded-full border border-[#0d0d0d] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[1]"
                        style={{ left: `${p.x}%`, top: `${p.y}%`, background: p.color }}
                      />
                    ))}
                    <div className="absolute inset-0 flex">
                      {years.map(year => (
                        <div
                          key={year}
                          className="flex-1 h-full cursor-crosshair"
                          onMouseEnter={() => setHoveredRegionYear(year)}
                          onMouseLeave={() => setHoveredRegionYear(null)}
                        />
                      ))}
                    </div>
                  </div>
                  {yearAxisMarks()}
                  <div className="flex flex-wrap gap-x-2 gap-y-1">
                    {activeRegions.map(region => {
                      const muted = mutedRegions.has(region)
                      return (
                        <button
                          key={region}
                          type="button"
                          onClick={() => toggleRegion(region)}
                          onDoubleClick={e => {
                            e.preventDefault()
                            soloRegion(region)
                          }}
                          title="Click to mute · Double-click to solo"
                          className={`flex items-center gap-1 rounded px-1 py-0.5 transition-opacity ${
                            muted ? 'opacity-35' : 'opacity-100 hover:bg-zinc-800/50'
                          }`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: REGION_COLORS[region] }}
                          />
                          <span className={`text-[8px] ${muted ? 'text-zinc-600 line-through' : 'text-zinc-500'}`}>
                            {region}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Movers + largest list — shared year filter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch">
            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">Top Movers (3Y avg)</div>
                <select
                  aria-label="Top movers end year"
                  value={effectiveDetailYear ?? ''}
                  onChange={e => setDetailYear(parseInt(e.target.value, 10))}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  {detailYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {topMovers.up.length === 0 && topMovers.down.length === 0 ? (
                <div className="text-xs text-zinc-600 py-2">Need enough years for a 3-year window.</div>
              ) : (
                <div className="grid grid-cols-2 gap-5 flex-1">
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-emerald-500/80 mb-2.5">Rising</div>
                    <div className="space-y-2">
                      {topMovers.up.map((m, i) => {
                        const flagUrl = getFlagUrl(m.country, 40)
                        return (
                          <div key={m.country} className="flex items-center gap-2">
                            <div className="text-[9px] text-zinc-600 tabular-nums w-3 text-right shrink-0">{i + 1}</div>
                            {flagUrl ? (
                              <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shrink-0 opacity-90" decoding="async" />
                            ) : (
                              <span className="w-4 h-3 rounded-[1px] bg-zinc-800 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] text-zinc-200 truncate">{m.country}</div>
                              <div className="text-[9px] text-zinc-600 tabular-nums truncate">
                                {formatCost(m.prev)} → {formatCost(m.curr)}
                              </div>
                            </div>
                            <div className="text-[10px] font-mono text-emerald-400/90 tabular-nums shrink-0">
                              +{formatCost(m.delta)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-widest text-red-400/80 mb-2.5">Falling</div>
                    <div className="space-y-2">
                      {topMovers.down.map((m, i) => {
                        const flagUrl = getFlagUrl(m.country, 40)
                        return (
                          <div key={m.country} className="flex items-center gap-2">
                            <div className="text-[9px] text-zinc-600 tabular-nums w-3 text-right shrink-0">{i + 1}</div>
                            {flagUrl ? (
                              <img src={flagUrl} alt="" className="w-4 h-3 object-cover rounded-[1px] shrink-0 opacity-90" decoding="async" />
                            ) : (
                              <span className="w-4 h-3 rounded-[1px] bg-zinc-800 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] text-zinc-200 truncate">{m.country}</div>
                              <div className="text-[9px] text-zinc-600 tabular-nums truncate">
                                {formatCost(m.prev)} → {formatCost(m.curr)}
                              </div>
                            </div>
                            <div className="text-[10px] font-mono text-red-400/90 tabular-nums shrink-0">
                              −{formatCost(Math.abs(m.delta))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-5">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">
                  Largest Notifications
                </div>
                <select
                  aria-label="Largest notifications year"
                  value={effectiveLargestYear === 'All' ? 'All' : String(effectiveLargestYear)}
                  onChange={e => {
                    const v = e.target.value
                    setLargestYear(v === 'All' ? 'All' : parseInt(v, 10))
                  }}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  <option value="All">All years</option>
                  {detailYearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {largestNotifications.length === 0 ? (
                <div className="text-xs text-zinc-600 py-2">No notifications for this year.</div>
              ) : (
                <div className="flex flex-col flex-1 min-h-0">
                  {largestNotifications.map((n, i) => (
                    <div
                      key={`${n.transmittal ?? n.date}-${i}`}
                      className="flex items-center flex-1 min-h-0"
                    >
                      <div className="flex items-start gap-2 w-full">
                        <div className="text-[9px] text-zinc-600 tabular-nums w-3.5 text-right shrink-0 pt-0.5">
                          {i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[11px] text-zinc-200 truncate">{n.system ?? 'Unknown system'}</div>
                          <div className="text-[9px] text-zinc-600 truncate">
                            {n.country ?? '—'} · {yearOf(n)}
                          </div>
                        </div>
                        <div className="text-[11px] font-semibold text-[#c4873a] tabular-nums shrink-0 pt-0.5">
                          {formatCost(n.costUSD)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* What they sell */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5 items-stretch">
            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium shrink-0">By Category</div>
                {activeCategoryLeaf && (
                  <div className="min-w-0 sm:flex-1 text-[12px] font-mono text-zinc-300 truncate">
                    <span className="text-zinc-500">{activeCategoryLeaf.cat}</span>
                    {' · '}
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: CATEGORY_COLORS[activeCategoryLeaf.cat] }}
                    >
                      {formatCost(activeCategoryLeaf.value)}
                    </span>
                  </div>
                )}
                <select
                  aria-label="Category year"
                  value={equipmentYear === 'All' ? 'All' : String(equipmentYear)}
                  onChange={e => {
                    const v = e.target.value
                    setEquipmentYear(v === 'All' ? 'All' : parseInt(v, 10))
                  }}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  <option value="All">All years</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              {categoryLeaves.length === 0 ? (
                <div className="text-xs text-zinc-600 py-2">No category data for this range.</div>
              ) : (
                <div className="flex-1 min-h-[280px] overflow-hidden rounded-md">
                  <CategoryTreemap
                    horizontal
                    items={categoryLeaves}
                    activeCat={hoveredCategory}
                    onHover={setHoveredCategory}
                  />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-[#111111] px-4 py-4 flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
                <div className="text-[11px] uppercase tracking-[0.14em] text-zinc-400 font-medium">Top Systems</div>
                <select
                  aria-label="Top systems year"
                  value={equipmentYear === 'All' ? 'All' : String(equipmentYear)}
                  onChange={e => {
                    const v = e.target.value
                    setEquipmentYear(v === 'All' ? 'All' : parseInt(v, 10))
                  }}
                  className={yearSelectClass}
                  style={yearSelectStyle}
                >
                  <option value="All">All years</option>
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col flex-1 min-h-0">
                {topSystems.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-2">No system data for this range.</div>
                ) : (
                  topSystems.map((sys, i) => {
                    const pct = maxSystemValue > 0 ? sys.value / maxSystemValue : 0
                    return (
                      <div key={`${sys.label}-${i}`} className="flex items-center gap-2 sm:gap-3 flex-1 min-h-0">
                        <div className="text-[9px] text-zinc-600 tabular-nums w-4 text-right shrink-0">{i + 1}</div>
                        <div className="w-36 sm:w-48 shrink-0 min-w-0">
                          <span className="text-[11px] text-zinc-300 truncate block">{sys.label}</span>
                        </div>
                        <div className="flex-1 h-3 bg-zinc-900/80 rounded-sm overflow-hidden min-w-0 pointer-events-none">
                          {renderBar(pct, i)}
                        </div>
                        <div className="text-[11px] font-semibold text-[#c4873a] tabular-nums w-16 sm:w-20 text-right shrink-0">
                          {formatCost(sys.value)}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-zinc-600 leading-relaxed max-w-3xl pt-2">
            <span className="text-red-500">*</span> These figures are U.S. Foreign Military Sales (FMS) congressional notifications, or
            proposed transfers Congress is told about, not confirmed deliveries or signed contracts.
            Some notifications never close; others do, but final dollar amounts, timelines, or
            contractors can differ from what was notified. This also covers only
            government-to-government FMS, not Direct Commercial Sales (DCS) or other arms-transfer
            channels. Even so, the data still gives a useful rough picture of how the FMS
            ecosystem is shaped and where demand has concentrated over time.
          </p>
        </div>
      </div>
    </div>
  )
}
