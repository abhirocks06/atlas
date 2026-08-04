import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatCost } from '../utils/formatters'

interface YearPoint {
  year: number
  value: number
}

interface Props {
  yearTotals: YearPoint[]
  /** When true, omit outer section borders (parent provides a card shell). */
  embedded?: boolean
  /** Larger chart for the Trends headline */
  tall?: boolean
  /** How to format the metric in hover / peak labels */
  formatValue?: (value: number) => string
  stroke?: string
  fill?: string
  onHoverYear?: (year: number | null) => void
}

export function YearTrendChart({
  yearTotals,
  embedded = false,
  tall = false,
  formatValue = formatCost,
  stroke = '#c4873a',
  fill = '#c4873a',
  onHoverYear,
}: Props) {
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)

  const setHover = (year: number | null) => {
    setHoveredYear(year)
    onHoverYear?.(year)
  }
  const maxYearValue = Math.max(...yearTotals.map(d => d.value), 1)

  const yearChart = useMemo(() => {
    const n = yearTotals.length
    if (n === 0) return null
    const pts = yearTotals.map((d, i) => ({
      year: d.year,
      value: d.value,
      x: n === 1 ? 50 : (i / (n - 1)) * 100,
      y: 100 - (d.value / maxYearValue) * 88 - 6,
    }))
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const area = `${line} L${pts[pts.length - 1].x.toFixed(2)},100 L${pts[0].x.toFixed(2)},100 Z`
    return { pts, line, area }
  }, [yearTotals, maxYearValue])

  if (yearTotals.length < 2 || !yearChart) return null

  const hoveredYearPt = hoveredYear !== null
    ? yearChart.pts.find(p => p.year === hoveredYear) ?? null
    : null

  const chartH = tall ? 100 : 56

  const labelYears = tall
    ? yearTotals.filter((_, i) => i === 0 || i === yearTotals.length - 1 || i % Math.ceil(yearTotals.length / 8) === 0)
    : [yearTotals[0], yearTotals[yearTotals.length - 1]]

  return (
    <div className={embedded ? '' : 'px-5 pt-5 pb-4 border-b border-zinc-800/60'}>
      {!tall && (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-600">By Year</div>
          {hoveredYear !== null && (
            <div className="text-[10px] font-mono text-zinc-400">
              {hoveredYear} · {formatValue(yearTotals.find(d => d.year === hoveredYear)?.value ?? 0)}
            </div>
          )}
        </div>
      )}

      {tall && (
        <div className="flex items-baseline justify-start mb-3 min-h-[1.25rem]">
          {hoveredYear !== null ? (
            <div className="text-[12px] font-mono text-zinc-300">
              <span className="text-zinc-500">{hoveredYear}</span>
              {' · '}
              <span style={{ color: stroke }}>
                {formatValue(yearTotals.find(d => d.year === hoveredYear)?.value ?? 0)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      <div className="relative w-full border-b border-zinc-800/80" style={{ height: chartH }}>
        <motion.svg
          key={yearTotals.map(d => `${d.year}:${d.value}`).join('|')}
          className="absolute inset-0 w-full h-full overflow-visible origin-bottom"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={{ scaleY: 0, opacity: 0.35 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <path d={yearChart.area} fill={fill} fillOpacity={tall ? 0.12 : 0.1} />
          <path
            d={yearChart.line}
            fill="none"
            stroke={stroke}
            strokeWidth={tall ? 2 : 1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity={0.9}
          />
        </motion.svg>
        {hoveredYearPt && (
          <div
            className="absolute w-2 h-2 rounded-full border border-[#0d0d0d] pointer-events-none -translate-x-1/2 -translate-y-1/2 z-[1]"
            style={{ left: `${hoveredYearPt.x}%`, top: `${hoveredYearPt.y}%`, background: stroke }}
          />
        )}
        <div className="absolute inset-0 flex">
          {yearTotals.map(d => (
            <div
              key={d.year}
              className="flex-1 h-full cursor-crosshair"
              onMouseEnter={() => setHover(d.year)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </div>
      </div>

      <div className={`relative pt-1.5 ${tall ? 'h-5' : ''}`}>
        {tall ? (
          labelYears.map(d => {
            const pt = yearChart.pts.find(p => p.year === d.year)
            if (!pt) return null
            return (
              <span
                key={d.year}
                className="absolute text-[8px] text-zinc-600 -translate-x-1/2"
                style={{ left: `${pt.x}%` }}
              >
                {d.year}
              </span>
            )
          })
        ) : (
          <div className="flex justify-between">
            <span className="text-[8px] text-zinc-600">{yearTotals[0].year}</span>
            <span className="text-[8px] text-zinc-600">{yearTotals[yearTotals.length - 1].year}</span>
          </div>
        )}
      </div>
    </div>
  )
}
