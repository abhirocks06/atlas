import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { getFlagUrl } from '../utils/countryFlags'
import { getNotificationKey } from '../utils/newNotifications'

interface Props {
  notifications: Notification[]
  onSelect: (country: string) => void
}

function formatBannerDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function buildSummary(visible: Notification[]): string {
  const latest = visible[0]
  if (!latest) return ''
  if (visible.length === 1) {
    const datePart = latest.date ? ` · ${formatDate(latest.date)}` : ''
    return `New notification: ${latest.country}, ${latest.system}${latest.costUSD ? ` · ${formatCost(latest.costUSD)}` : ''}${datePart}`
  }
  const datePart = latest.date ? ` · ${formatBannerDate(latest.date)}` : ''
  return `${visible.length} new notifications${datePart}`
}

export function NewNotificationBanner({ notifications, onSelect }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set())
  const [expanded, setExpanded] = useState(false)

  const visible = useMemo(
    () => notifications.filter(n => !dismissed.has(getNotificationKey(n))),
    [notifications, dismissed],
  )

  const canExpand = visible.length > 1

  useEffect(() => {
    if (!canExpand) setExpanded(false)
  }, [canExpand])

  const dismissAll = () => {
    setDismissed(prev => {
      const next = new Set(prev)
      for (const n of visible) next.add(getNotificationKey(n))
      return next
    })
    setExpanded(false)
  }

  const dismissOne = (n: Notification) => {
    setDismissed(prev => new Set(prev).add(getNotificationKey(n)))
  }

  const handleSelect = (n: Notification) => {
    const country = n.country
    dismissOne(n)
    setExpanded(false)
    if (country) onSelect(country)
  }

  const handleSummaryClick = () => {
    if (!canExpand) {
      handleSelect(visible[0])
      return
    }
    setExpanded(e => !e)
  }

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (expanded) {
      setExpanded(false)
      return
    }
    dismissAll()
  }

  return (
    <AnimatePresence initial={false}>
      {visible.length > 0 && (
        <motion.div
          key="new-notification-banner"
          className="relative flex-shrink-0 bg-[#111111] border-b border-zinc-800/80 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <button
            type="button"
            onClick={handleClose}
            aria-label={expanded ? 'Collapse notifications' : 'Dismiss notifications'}
            className="absolute right-3 top-2.5 z-10 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>

          <div className="flex justify-center pl-4 pr-9 sm:px-4">
            {/* Width locked to the summary so centering does not shift when the list opens.
                List uses w-0/min-w-full so it grows right from the green-dot gutter. */}
            <div className="w-fit max-w-full min-w-0 flex flex-col items-start">
              <div className="flex items-center gap-2 h-9 min-w-0">
                <div className="w-4 shrink-0 flex items-center justify-center" aria-hidden="true">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                </div>
                <button
                  type="button"
                  onClick={handleSummaryClick}
                  className="text-[12px] text-zinc-300 hover:text-zinc-100 underline underline-offset-[3px] decoration-zinc-600 hover:decoration-zinc-400 transition-colors min-w-0 truncate text-left"
                  aria-expanded={canExpand ? expanded : undefined}
                >
                  {buildSummary(visible)}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {canExpand && expanded && (
                  <motion.div
                    key="expanded-list"
                    className="w-0 min-w-full grid"
                    initial={{ gridTemplateRows: '0fr', opacity: 0 }}
                    animate={{ gridTemplateRows: '1fr', opacity: 1 }}
                    exit={{ gridTemplateRows: '0fr', opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <ul className="flex flex-col pb-1.5 w-max">
                        {visible.map((n, i) => {
                          const flagUrl = n.country ? getFlagUrl(n.country) : null
                          const isLast = i === visible.length - 1
                          return (
                            <li key={getNotificationKey(n)}>
                              <div className="flex gap-2">
                                <div className="w-4 shrink-0 flex items-center justify-center py-1.5" aria-hidden="true">
                                  <span className="relative w-4 h-4">
                                    <span className="absolute left-1/2 -translate-x-1/2 top-0 bottom-1/2 w-px bg-zinc-700" />
                                    {!isLast && (
                                      <span className="absolute left-1/2 -translate-x-1/2 top-1/2 bottom-0 w-px bg-zinc-700" />
                                    )}
                                    <span className="absolute left-1/2 top-1/2 -translate-y-1/2 w-2.5 h-px bg-zinc-700" />
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleSelect(n)}
                                  className="flex items-center gap-2 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-100 transition-colors text-left whitespace-nowrap"
                                >
                                  {flagUrl && (
                                    <img
                                      src={flagUrl}
                                      alt=""
                                      className="w-4 h-3 object-cover rounded-sm shrink-0 opacity-90"
                                      draggable={false}
                                    />
                                  )}
                                  <span>
                                    <span className="text-zinc-300">{n.country}</span>
                                    {n.costUSD ? (
                                      <span className="text-amber-500/90 font-mono"> · {formatCost(n.costUSD)}</span>
                                    ) : null}
                                  </span>
                                </button>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
