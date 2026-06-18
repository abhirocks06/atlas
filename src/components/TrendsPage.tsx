import { useState, useMemo } from 'react'
import type { Notification } from '../types'
import { formatCost } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES } from '../utils/weaponCategories'

interface Props {
  notifications: Notification[]
  onBack: () => void
}

const YEARS = [2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026] as const
type Year = (typeof YEARS)[number]

// Amber scale from dim to bright for choropleth-style bars
const AMBER_SCALE = [
  '#4a3010',
  '#6b4518',
  '#8c5a20',
  '#a86e28',
  '#c4873a',
  '#d4974a',
  '#e0aa60',
  '#e8bc78',
  '#f0cc90',
  '#f8dca8',
]

function amberForPct(pct: number): string {
  const idx = Math.max(0, Math.min(AMBER_SCALE.length - 1, Math.floor(pct * (AMBER_SCALE.length - 1))))
  return AMBER_SCALE[idx]
}

function yoyBadge(prev: number, curr: number): { label: string; color: string } | null {
  if (prev === 0) return null
  const pct = ((curr - prev) / prev) * 100
  if (pct >= 0) {
    return { label: `↑ +${pct.toFixed(0)}%`, color: '#4ade80' }
  }
  return { label: `↓ ${pct.toFixed(0)}%`, color: '#f87171' }
}

export function TrendsPage({ notifications, onBack }: Props) {
  const [recipientYear, setRecipientYear] = useState<Year | 'All'>('All')

  // Year totals
  const yearStats = useMemo(() => {
    const map = new Map<number, { value: number; count: number }>()
    for (const year of YEARS) map.set(year, { value: 0, count: 0 })
    for (const n of notifications) {
      const year = parseInt(n.date.slice(0, 4), 10)
      if (!YEARS.includes(year as Year)) continue
      const prev = map.get(year)!
      map.set(year, { value: prev.value + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return map
  }, [notifications])

  const maxYearValue = Math.max(...YEARS.map(y => yearStats.get(y)!.value), 1)

  // Top recipients
  const topRecipients = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>()
    const subset = recipientYear === 'All'
      ? notifications
      : notifications.filter(n => n.date.startsWith(String(recipientYear)))
    for (const n of subset) {
      if (!n.country) continue
      const prev = map.get(n.country) ?? { value: 0, count: 0 }
      map.set(n.country, { value: prev.value + (n.costUSD ?? 0), count: prev.count + 1 })
    }
    return [...map.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 10)
  }, [notifications, recipientYear])

  const maxRecipientValue = Math.max(...topRecipients.map(([, v]) => v.value), 1)

  // Category trends: per-year totals for each category
  const categoryYearData = useMemo(() => {
    const result = new Map<string, Map<number, number>>()
    for (const cat of ALL_CATEGORIES) {
      const yearMap = new Map<number, number>()
      for (const year of YEARS) yearMap.set(year, 0)
      result.set(cat, yearMap)
    }
    for (const n of notifications) {
      const year = parseInt(n.date.slice(0, 4), 10)
      if (!YEARS.includes(year as Year)) continue
      const cat = categorize(n.system)
      const yearMap = result.get(cat)!
      yearMap.set(year, (yearMap.get(year) ?? 0) + (n.costUSD ?? 0))
    }
    return result
  }, [notifications])

  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>()
    for (const cat of ALL_CATEGORIES) {
      const yearMap = categoryYearData.get(cat)!
      map.set(cat, [...yearMap.values()].reduce((a, b) => a + b, 0))
    }
    return map
  }, [categoryYearData])

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0f0f]">

      {/* ── Header ── */}
      <div className="px-8 py-5 border-b border-zinc-800 flex items-center gap-5 flex-shrink-0 bg-[#0d0d0d]">
        <button
          onClick={onBack}
          className="text-zinc-600 hover:text-zinc-300 text-[10px] uppercase tracking-widest flex items-center gap-2 transition-colors flex-shrink-0"
        >
          ← Map
        </button>
        <div className="w-px h-4 bg-zinc-800" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-normal text-white tracking-tight">Global Trends</h1>
          <p className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-widest">
            U.S. Arms Sales · 2026
          </p>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Year Comparison ── */}
        <div className="px-8 py-6 border-b border-white/[0.07]">
          <div className="text-[9px] uppercase tracking-widest text-white/20 mb-4">Year-over-Year Comparison</div>
          <div className="grid grid-cols-5 gap-4">
            {YEARS.map((year, idx) => {
              const stats = yearStats.get(year)!
              const barPct = maxYearValue > 0 ? (stats.value / maxYearValue) * 100 : 0
              const prevStats = idx > 0 ? yearStats.get(YEARS[idx - 1])! : null
              const badge = idx > 0 && prevStats ? yoyBadge(prevStats.value, stats.value) : null
              const isPartial = year === 2026
              const isIncomplete = false

              return (
                <div
                  key={year}
                  className="bg-[#141414] border border-white/[0.07] rounded-sm p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-[9px] uppercase tracking-widest text-white/30">{year}</div>
                    {idx === 0 ? (
                      <span className="text-[9px] text-white/20">—</span>
                    ) : badge ? (
                      <span
                        className="text-[9px] font-semibold tabular-nums"
                        style={{ color: badge.color }}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                  </div>

                  <div className="text-xl font-semibold text-[#c4873a] tabular-nums mb-0.5">
                    {formatCost(stats.value)}
                  </div>
                  <div className="text-[10px] text-white/30 mb-3">
                    {stats.count} deal{stats.count !== 1 ? 's' : ''}
                    {isPartial && <span className="ml-1 text-white/20">(partial)</span>}
                    {isIncomplete && <span className="ml-1 text-white/20">(incomplete)</span>}
                  </div>

                  {/* Proportional bar */}
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barPct}%`,
                        background: '#c4873a',
                        opacity: (isPartial || isIncomplete) ? 0.5 : 0.8,
                      }}
                    />
                  </div>
                  {isPartial && (
                    <div className="text-[8px] text-white/20 mt-1.5 uppercase tracking-widest">Jan–Jun only</div>
                  )}
                  {isIncomplete && (
                    <div className="text-[8px] text-white/20 mt-1.5 uppercase tracking-widest">Partial dataset</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Top Recipients ── */}
        <div className="px-8 py-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-[9px] uppercase tracking-widest text-white/20">Top Recipients</div>
            <div className="flex items-center gap-1.5 ml-auto">
              {(['All', ...YEARS] as const).map(y => (
                <button
                  key={y}
                  onClick={() => setRecipientYear(y as Year | 'All')}
                  className={`text-[9px] uppercase tracking-widest px-2 py-1 rounded-sm border transition-colors ${
                    recipientYear === y
                      ? 'border-white/20 text-white/60 bg-white/[0.05]'
                      : 'border-transparent text-white/25 hover:text-white/45'
                  }`}
                >
                  {y === 'All' ? 'All Years' : y}
                  {y === 2026 && <span className="ml-0.5 text-white/15">*</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {topRecipients.length === 0 && (
              <div className="text-xs text-white/20 py-4">No data for this period.</div>
            )}
            {topRecipients.map(([country, data], i) => {
              const pct = maxRecipientValue > 0 ? data.value / maxRecipientValue : 0
              const barColor = amberForPct(pct)
              return (
                <div key={country} className="flex items-center gap-3">
                  <div className="text-[9px] text-white/20 tabular-nums w-4 text-right">{i + 1}</div>
                  <div className="w-32 text-[10px] text-white/50 truncate flex-shrink-0">{country}</div>
                  <div className="flex-1 h-4 bg-white/[0.04] rounded-sm overflow-hidden relative">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${pct * 100}%`, background: barColor }}
                    />
                  </div>
                  <div className="text-[9px] text-white/30 w-8 tabular-nums">{data.count}×</div>
                  <div className="text-[10px] font-semibold text-[#c4873a] tabular-nums w-20 text-right">
                    {formatCost(data.value)}
                  </div>
                </div>
              )
            })}
          </div>
          {recipientYear === 2026 && (
            <div className="text-[8px] text-white/20 mt-3 uppercase tracking-widest">* 2026 is partial year (Jan–Jun) · 2022 is incomplete dataset</div>
          )}
        </div>

        {/* ── Category Trends ── */}
        <div className="px-8 py-6">
          <div className="text-[9px] uppercase tracking-widest text-white/20 mb-4">Category Trends · Relative Spend by Year</div>

          {/* Year labels header */}
          <div className="flex items-center gap-3 mb-3 pl-48">
            {YEARS.map(y => (
              <div key={y} className="flex-1 text-center text-[8px] text-white/20 uppercase tracking-widest">
                {y}{(y === 2026 || y === 2022) && <span className="text-white/10">*</span>}
              </div>
            ))}
            <div className="w-20 text-right text-[8px] text-white/20 uppercase tracking-widest">Total</div>
          </div>

          <div className="space-y-2">
            {ALL_CATEGORIES.map(cat => {
              const color = CATEGORY_COLORS[cat]
              const yearMap = categoryYearData.get(cat)!
              const total = categoryTotals.get(cat)!
              const yearValues = YEARS.map(y => yearMap.get(y) ?? 0)
              const maxVal = Math.max(...yearValues, 1)

              return (
                <div key={cat} className="flex items-center gap-3 py-1">
                  {/* Category name + dot */}
                  <div className="flex items-center gap-2 w-44 flex-shrink-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: color }}
                    />
                    <span className="text-[10px] text-white/45 truncate">{cat}</span>
                  </div>

                  {/* Mini bars per year */}
                  {YEARS.map(y => {
                    const val = yearMap.get(y) ?? 0
                    const pct = maxVal > 0 ? (val / maxVal) * 100 : 0
                    return (
                      <div key={y} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full h-6 bg-white/[0.03] rounded-sm overflow-hidden flex items-end">
                          <div
                            className="w-full rounded-sm"
                            style={{
                              height: `${Math.max(pct, pct > 0 ? 4 : 0)}%`,
                              background: color,
                              opacity: (y === 2026 || y === 2022) ? 0.5 : 0.7,
                            }}
                          />
                        </div>
                        {val > 0 && (
                          <div className="text-[7px] text-white/20 tabular-nums">{formatCost(val)}</div>
                        )}
                      </div>
                    )
                  })}

                  {/* Total */}
                  <div className="w-20 text-right text-[10px] font-semibold text-[#c4873a] tabular-nums flex-shrink-0">
                    {total > 0 ? formatCost(total) : <span className="text-white/15">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="text-[8px] text-white/15 mt-4 uppercase tracking-widest">* 2026 is partial year (Jan–Jun only) · 2022 is incomplete dataset</div>
        </div>

      </div>
    </div>
  )
}
