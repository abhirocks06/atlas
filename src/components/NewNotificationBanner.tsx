import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost } from '../utils/formatters'
import {
  getNotificationKey,
} from '../utils/newNotifications'

interface Props {
  notifications: Notification[]
  onSelect: (country: string) => void
}

function buildLabel(notifications: Notification[]): string {
  const latest = notifications[0]
  const country = latest.country ?? 'Unknown'
  const system = latest.system ?? 'Foreign Military Sale'
  const cost = latest.costUSD ? ` · ${formatCost(latest.costUSD)}` : ''
  const extra = notifications.length - 1

  if (notifications.length === 1) {
    return `New notification: ${country}, ${system}${cost}`
  }
  return `${notifications.length} new notifications: ${country}, ${system}${cost}${extra > 0 ? ` · +${extra} more` : ''}`
}

export function NewNotificationBanner({ notifications, onSelect }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())

  const visible = useMemo(
    () => notifications.filter(n => !dismissed.has(getNotificationKey(n))),
    [notifications, dismissed],
  )

  const dismiss = (items: Notification[]) => {
    setDismissed(prev => {
      const next = new Set(prev)
      for (const n of items) next.add(getNotificationKey(n))
      return next
    })
  }

  const handleOpen = () => {
    const country = visible[0]?.country
    dismiss(visible)
    if (country) onSelect(country)
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    dismiss(visible)
  }

  return (
    <AnimatePresence>
      {visible.length > 0 && (
        <motion.div
          className="relative flex-shrink-0 flex items-center justify-center bg-[#1a1a1a] border-b border-zinc-800/80 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 36, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-2 px-12 text-[12px] text-zinc-300 hover:text-zinc-100 underline underline-offset-[3px] decoration-zinc-600 hover:decoration-zinc-400 transition-colors max-w-full min-w-0"
          >
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span className="truncate">{buildLabel(visible)}</span>
          </button>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Dismiss notification"
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
