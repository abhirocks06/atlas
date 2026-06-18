import type { Notification } from '../types'
import { formatCost } from '../utils/formatters'

interface Props {
  filtered: Notification[]
}

export function SummaryStats({ filtered }: Props) {
  const total = filtered.reduce((sum, n) => sum + (n.costUSD ?? 0), 0)
  const countries = new Set(filtered.map(n => n.country).filter(Boolean)).size

  return (
    <div className="flex items-center gap-4 md:gap-6 text-right">
      <div>
        <div className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">Total Value</div>
        <div className="text-xs md:text-sm font-mono text-amber-400">{formatCost(total)}</div>
      </div>
      <div>
        <div className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">Notifications</div>
        <div className="text-xs md:text-sm font-mono text-zinc-300">{filtered.length}</div>
      </div>
      <div className="hidden sm:block">
        <div className="text-[9px] md:text-[10px] text-zinc-600 uppercase tracking-widest mb-0.5">Countries</div>
        <div className="text-xs md:text-sm font-mono text-zinc-300">{countries}</div>
      </div>
    </div>
  )
}
