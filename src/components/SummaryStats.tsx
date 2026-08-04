import { useEffect } from 'react'
import type { Notification } from '../types'
import { formatCost } from '../utils/formatters'
import { useCountUp } from '../utils/useCountUp'

interface Props {
  filtered: Notification[]
}

/** Intro count-up only on the first home visit this session — not when returning from a country. */
let homeStatsIntroDone = false

export function SummaryStats({ filtered }: Props) {
  const total = filtered.reduce((sum, n) => sum + (n.costUSD ?? 0), 0)
  const countries = new Set(filtered.map(n => n.country).filter(Boolean)).size
  const skipIntro = homeStatsIntroDone
  const animatedTotal = useCountUp(total, 1200, { skipIntro })
  const animatedNotifs = useCountUp(filtered.length, 1200, { skipIntro })
  const animatedCountries = useCountUp(countries, 1200, { skipIntro })

  useEffect(() => {
    homeStatsIntroDone = true
  }, [])

  return (
    <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-4 md:gap-6">
      <div className="min-w-0 sm:text-right">
        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">
          Total Value
        </div>
        <div className="text-sm font-mono text-amber-400 tabular-nums truncate">
          {formatCost(animatedTotal)}
        </div>
      </div>
      <div className="min-w-0 text-center sm:text-right">
        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">
          Notifications
        </div>
        <div className="text-sm font-mono text-zinc-300 tabular-nums">
          {Math.round(animatedNotifs).toLocaleString()}
        </div>
      </div>
      <div className="min-w-0 text-right">
        <div className="text-[8px] sm:text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">
          Countries
        </div>
        <div className="text-sm font-mono text-zinc-300 tabular-nums">
          {Math.round(animatedCountries).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
