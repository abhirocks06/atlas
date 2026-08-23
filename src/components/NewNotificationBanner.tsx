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

function bannerSystemLabel(n: Notification): string | null {
  if (n.transmittal === '26-92') return 'APKWS-II Guidance Sections'
  return n.system ?? null
}

function buildSummary(visible: Notification[]): string {
  const latest = visible[0]
  if (!latest) return ''
  if (visible.length === 1) {
    const datePart = latest.date ? ` · ${formatDate(latest.date)}` : ''
    return `New notification: ${latest.country}, ${latest.system}${latest.costUSD ? ` · ${formatCost(latest.costUSD)}` : ''}${datePart}`
  }
  return `${visible.length} new notifications: ${latest.country}, ${latest.system}${latest.costUSD ? ` · ${formatCost(latest.costUSD)}` : ''} · +${visible.length - 1} more`
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
          <div className="relative flex justify-center px-12">
            <div className="w-full max-w-xl min-w-0">
              {/* Summary row */}
              <div className="flex gap-2">
                <div className="relative w-4 shrink-0 h-9 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 relative z-10" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 flex items-center h-9">
                  <button
                    type="button"
                    onClick={handleSummaryClick}
                    className="text-[12px] text-zinc-300 hover:text-zinc-100 underline underline-offset-[3px] decoration-zinc-600 hover:decoration-zinc-400 transition-colors max-w-full min-w-0 truncate text-left"
                    aria-expanded={canExpand ? expanded : undefined}
                  >
                    {buildSummary(visible)}
                  </button>
                </div>
              </div>

              <AnimatePresence initial={false}>
                {canExpand && expanded && (
                  <motion.div
                    key="expanded-list"
                    className="overflow-hidden"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    <ul className="flex flex-col pb-1.5 w-full">
                      {visible.map((n, i) => {
                        const flagUrl = n.country ? getFlagUrl(n.country) : null
                        const isLast = i === visible.length - 1
                        const systemLabel = bannerSystemLabel(n)
                        return (
                          <li key={getNotificationKey(n)}>
                            <div className="flex gap-2">
                              <div className="w-4 shrink-0 flex items-center justify-center py-1.5" aria-hidden="true">
                                <span className="relative w-4 h-4">
                                  <span
                                    className={`absolute left-1/2 -translate-x-1/2 w-px bg-zinc-700 ${
                                      i === 0 ? '-top-2.5' : 'top-0'
                                    } bottom-1/2`}
                                  />
                                  {!isLast && (
                                    <span className="absolute left-1/2 -translate-x-1/2 top-1/2 bottom-0 w-px bg-zinc-700" />
                                  )}
                                  <span className="absolute left-1/2 top-1/2 -translate-y-1/2 w-2.5 h-px bg-zinc-700" />
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelect(n)}
                                className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-[12px] text-zinc-400 hover:text-zinc-100 transition-colors text-left"
                              >
                                {flagUrl && (
                                  <img
                                    src={flagUrl}
                                    alt=""
                                    className="w-4 h-3 object-cover rounded-sm shrink-0 opacity-90"
                                    draggable={false}
                                  />
                                )}
                                <span className="truncate min-w-0">
                                  <span className="text-zinc-300">{n.country}</span>
                                  {systemLabel ? (
                                    <span className="text-zinc-500"> · {systemLabel}</span>
                                  ) : null}
                                  {n.costUSD ? (
                                    <span className="text-amber-500/90 font-mono"> · {formatCost(n.costUSD)}</span>
                                  ) : null}
                                  {n.date ? (
                                    <span className="text-zinc-600 font-mono"> · {formatDate(n.date)}</span>
                                  ) : null}
                                </span>
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={handleClose}
              aria-label={expanded ? 'Collapse notifications' : 'Dismiss notifications'}
              className="absolute right-3 top-2.5 p-1 text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
