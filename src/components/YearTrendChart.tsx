import { useMemo, useState } from 'react'
import { formatCost } from '../utils/formatters'

interface YearPoint {
  year: number
  value: number
}

interface Props {
  yearTotals: YearPoint[]
  /** When true, omit outer section borders (parent provides a card shell). */
  embedded?: boolean
}

export function YearTrendChart({ yearTotals, embedded = false }: Props) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)
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

  if (yearTotals.length < 2 || !yearChart) return null

  const hoveredYearPt = hoveredYear !== null
    ? yearChart.pts.find(p => p.year === hoveredYear) ?? null
    : null

  return (
    <div className={embedded ? '' : 'px-5 pt-5 pb-4 border-b border-zinc-800/60'}>
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
  )
}
