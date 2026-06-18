import { useState } from 'react'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { categorize, CATEGORY_COLORS, ALL_CATEGORIES, type WeaponCategory } from '../utils/weaponCategories'

interface Props {
  country: string
  notifications: Notification[]
  total: number
  onClose: () => void
}

export function SidePanel({ country, notifications, onClose }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [activeCategory, setActiveCategory] = useState<WeaponCategory | null>(null)
  const [sort, setSort] = useState<'date' | 'cost'>('date')

  // Category breakdown
  const categoryTotals = new Map<WeaponCategory, { cost: number; count: number }>()
  for (const n of notifications) {
    const cat = categorize(n.system)
    const prev = categoryTotals.get(cat) ?? { cost: 0, count: 0 }
    categoryTotals.set(cat, { cost: prev.cost + (n.costUSD ?? 0), count: prev.count + 1 })
  }
  const maxCat = Math.max(...[...categoryTotals.values()].map(v => v.cost), 1)

  const filtered = notifications
    .filter(n => !activeCategory || categorize(n.system) === activeCategory)
    .sort((a, b) => sort === 'date'
      ? b.date.localeCompare(a.date)
      : (b.costUSD ?? 0) - (a.costUSD ?? 0)
    )

  const knownCost = notifications.reduce((s, n) => s + (n.costUSD ?? 0), 0)
  const unknownCount = notifications.filter(n => n.costUSD === null).length

  return (
    <div className="w-[420px] bg-[#0d1017] border-l border-[#1e2535] flex flex-col overflow-hidden flex-shrink-0">

      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[#1e2535]">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#c9c3b8] tracking-wide">{country}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-lg font-semibold text-[#c4873a]">{formatCost(knownCost)}</span>
              <span className="text-xs text-[#4a5568]">
                {notifications.length} deal{notifications.length !== 1 ? 's' : ''}
                {unknownCount > 0 && ` · ${unknownCount} cost unknown`}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-[#3a4050] hover:text-[#6b7a8d] text-xl leading-none mt-0.5">×</button>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="px-5 py-3 border-b border-[#1e2535]">
        <div className="text-[9px] uppercase tracking-widest text-[#3a4050] mb-2.5">By weapon category · click to filter</div>
        <div className="space-y-2">
          {ALL_CATEGORIES.filter(cat => categoryTotals.has(cat)).map(cat => {
            const data = categoryTotals.get(cat)!
            const pct = (data.cost / maxCat) * 100
            const isActive = activeCategory === cat
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(isActive ? null : cat)}
                className={`w-full text-left transition-opacity ${activeCategory && !isActive ? 'opacity-30' : ''}`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px]" style={{ color: isActive ? CATEGORY_COLORS[cat] : '#8b9bb4' }}>{cat}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#3a4050]">{data.count}×</span>
                    <span className="text-[10px] font-medium" style={{ color: CATEGORY_COLORS[cat] }}>
                      {formatCost(data.cost)}
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-[#131720] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: CATEGORY_COLORS[cat], opacity: isActive ? 1 : 0.5 }}
                  />
                </div>
              </button>
            )
          })}
        </div>
        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            className="mt-2.5 text-[9px] text-[#4a5568] hover:text-[#8b9bb4] uppercase tracking-wider"
          >
            ← Clear filter
          </button>
        )}
      </div>

      {/* Sort controls */}
      <div className="px-5 py-2 border-b border-[#1e2535] flex items-center gap-4">
        <span className="text-[9px] text-[#2a3040] uppercase tracking-wider">Sort</span>
        <button
          onClick={() => setSort('date')}
          className={`text-[10px] uppercase tracking-wider transition-colors ${sort === 'date' ? 'text-[#8b9bb4]' : 'text-[#3a4050] hover:text-[#4a5568]'}`}
        >
          Date
        </button>
        <button
          onClick={() => setSort('cost')}
          className={`text-[10px] uppercase tracking-wider transition-colors ${sort === 'cost' ? 'text-[#8b9bb4]' : 'text-[#3a4050] hover:text-[#4a5568]'}`}
        >
          Value
        </button>
        <span className="ml-auto text-[9px] text-[#2a3040]">
          {filtered.length}{filtered.length !== notifications.length && ` / ${notifications.length}`}
        </span>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {filtered.map((n, i) => {
          const cat = categorize(n.system)
          const isOpen = expandedIdx === i
          return (
            <div
              key={i}
              className={`border-b border-[#0f1318] ${isOpen ? 'bg-[#131824]' : ''}`}
            >
              {/* Row — click to expand */}
              <button
                className="w-full text-left px-5 py-3 hover:bg-[#0f1420] transition-colors"
                onClick={() => setExpandedIdx(isOpen ? null : i)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-sm font-medium"
                      style={{ background: CATEGORY_COLORS[cat] + '28', color: CATEGORY_COLORS[cat] }}
                    >
                      {cat.split(' ')[0]}
                    </span>
                    {n.transmittal && (
                      <span className="text-[9px] text-[#2a3040]">{n.transmittal}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#3a4050]">{formatDate(n.date)}</span>
                    <span className={`text-[10px] text-[#2a3040] transition-transform inline-block ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                  </div>
                </div>
                <div className="text-xs text-[#b0a898] leading-snug line-clamp-2">
                  {n.system ?? <span className="text-[#2a3040] italic">System not specified</span>}
                </div>
                <div className="mt-1.5 font-semibold text-sm" style={{ color: n.costUSD ? '#c4873a' : '#2a3040' }}>
                  {n.costUSD ? formatCost(n.costUSD) : 'Unknown value'}
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-5 pb-4 space-y-3 border-t border-[#1a2030]">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-0.5">Category</div>
                      <div className="text-[10px]" style={{ color: CATEGORY_COLORS[cat] }}>{cat}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-0.5">Date</div>
                      <div className="text-[10px] text-[#6b7a8d]">{formatDate(n.date)}</div>
                    </div>
                    {n.transmittal && (
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-0.5">Transmittal</div>
                        <div className="text-[10px] text-[#6b7a8d]">No. {n.transmittal}</div>
                      </div>
                    )}
                    {n.costUSD && (
                      <div>
                        <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-0.5">Estimated Value</div>
                        <div className="text-[10px] font-medium text-[#c4873a]">{formatCost(n.costUSD)}</div>
                      </div>
                    )}
                  </div>

                  {n.system && (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-1">Equipment</div>
                      <div className="text-xs text-[#8b9bb4] leading-relaxed">{n.system}</div>
                    </div>
                  )}

                  {n.contractor && (
                    <div>
                      <div className="text-[9px] uppercase tracking-widest text-[#2a3040] mb-1">Principal Contractor</div>
                      <div className="text-xs text-[#8b9bb4]">{n.contractor}</div>
                      {n.contractorLocation && (
                        <div className="text-[10px] text-[#4a5568] mt-0.5">{n.contractorLocation}</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
