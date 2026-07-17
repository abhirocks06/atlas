import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Notification } from '../types'
import { formatCost, formatDate } from '../utils/formatters'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, contractorLogoClassName } from '../utils/contractorLogos'
import { parseContractors, supplySource } from '../utils/parseContractors'
import { isNotificationNew } from '../utils/newNotifications'
import { getSystemVisual } from '../utils/systemVisuals'
import { CategoryIcon } from './CategoryIcon'

interface Props {
  notification: Notification | null
  country: string
  onClose: () => void
  onSelectContractor?: (contractor: string) => void
}

export function SaleDetailDrawer({ notification, country, onClose, onSelectContractor }: Props) {
  useEffect(() => {
    if (!notification) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [notification, onClose])

  const n = notification
  const visual = n ? getSystemVisual(n.system) : null
  const flagUrl = getFlagUrl(country)
  const contractors = n ? parseContractors(n.contractor, n.contractorLocation) : []
  const source = n ? supplySource(n.contractor) : null

  return (
    <AnimatePresence>
      {n && visual && (
        <>
          <motion.button
            type="button"
            aria-label="Close sale details"
            className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.aside
            className="fixed inset-y-0 right-0 z-[70] w-full max-w-[440px] bg-[#0c0c0c] border-l border-zinc-800 shadow-2xl shadow-black/50 flex flex-col"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            role="dialog"
            aria-modal="true"
            aria-label={n.system ?? 'Sale details'}
          >
            {/* Hero: fixed image band; title overlays bottom and grows downward (never upward) */}
            <div className="flex-shrink-0">
              <div className="relative h-52 md:h-56 overflow-hidden">
                <div className="absolute inset-0" style={{ background: visual.atmosphere }} />

                {visual.imageUrl ? (
                  <img
                    src={visual.imageUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    decoding="async"
                    onError={e => {
                      const img = e.currentTarget as HTMLImageElement
                      img.style.display = 'none'
                      const fallback = img.parentElement?.querySelector('[data-hero-fallback]')
                      if (fallback instanceof HTMLElement) fallback.style.display = 'flex'
                    }}
                  />
                ) : null}

                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0c0c] via-[#0c0c0c]/55 to-transparent" />
                <div
                  className="absolute inset-0 opacity-40 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.12) 1px, transparent 0)',
                    backgroundSize: '18px 18px',
                  }}
                />

                <div
                  data-hero-fallback
                  className="absolute inset-0 items-center justify-center opacity-30"
                  style={{ display: visual.imageUrl ? 'none' : 'flex' }}
                >
                  <CategoryIcon category={visual.category} size={88} color={visual.color} />
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 text-zinc-400 hover:text-zinc-100 hover:bg-black/60 transition-colors"
                  aria-label="Close"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 3l8 8M11 3L3 11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* -mt pulls title onto the image; block grows down so line 1 stays put */}
              <div className="relative z-[1] -mt-[5.5rem] px-5 md:px-6 pt-2 pb-5">
                <div className="flex items-center gap-2 mb-2.5">
                  {flagUrl && (
                    <img src={flagUrl} alt="" className="w-5 h-3.5 object-cover rounded-sm shadow" draggable={false} />
                  )}
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">{country}</span>
                  {isNotificationNew(n) && (
                    <span className="px-1.5 py-px rounded text-[8px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      New
                    </span>
                  )}
                </div>
                <h2 className="text-xl md:text-[22px] font-light text-white leading-snug tracking-tight">
                  {n.system ?? 'Unspecified system'}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium"
                    style={{ color: visual.color }}
                  >
                    <CategoryIcon category={visual.category} size={12} color={visual.color} />
                    {visual.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 md:px-6 py-5 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Estimated value</div>
                  <div className={`text-sm font-mono ${n.costUSD ? 'text-amber-400' : 'text-zinc-700'}`}>
                    {n.costUSD ? formatCost(n.costUSD) : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Notification date</div>
                  <div className="text-sm font-mono text-zinc-300">{formatDate(n.date)}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Transmittal</div>
                  <div className="text-sm font-mono text-zinc-300">{n.transmittal ?? '—'}</div>
                </div>
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-1">Recipient</div>
                  <div className="text-sm text-zinc-300">{country}</div>
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">What it does</div>
                <p className="text-[13px] text-zinc-400 leading-relaxed">{visual.blurb}</p>
              </div>

              {source && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">Source</div>
                  <div className="text-[13px] text-zinc-300">{source}</div>
                </div>
              )}

              {contractors.length > 0 && (
                <div>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-600 mb-2">
                    {contractors.length > 1 ? 'Principal contractors' : 'Principal contractor'}
                  </div>
                  <div className="space-y-3">
                    {contractors.map(c => {
                      const logo = getContractorLogoUrl(c.name)
                      const body = (
                        <>
                          {logo && (
                            <img
                              src={logo}
                              alt=""
                              className={`w-8 h-8 object-contain opacity-70 mt-0.5 ${contractorLogoClassName(c.name)}`}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                          )}
                          <div className="min-w-0">
                            <div className={`text-[13px] text-zinc-300 ${onSelectContractor ? 'group-hover:text-white transition-colors' : ''}`}>
                              {c.name}
                            </div>
                            {c.location && (
                              <div className="text-[11px] text-zinc-600 mt-1">{c.location}</div>
                            )}
                          </div>
                        </>
                      )
                      if (onSelectContractor) {
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => onSelectContractor(c.name)}
                            className="flex items-start gap-3 w-full text-left group cursor-pointer"
                          >
                            {body}
                          </button>
                        )
                      }
                      return (
                        <div key={c.name} className="flex items-start gap-3">
                          {body}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {visual.imageCredit && (
                <p className="text-[9px] text-zinc-700 leading-relaxed">Image: {visual.imageCredit}</p>
              )}
            </div>

            {/* Footer */}
            {n.sourceUrl && (
              <div className="flex-shrink-0 px-5 md:px-6 py-4 border-t border-zinc-800/80">
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-[11px] uppercase tracking-widest text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 transition-colors"
                >
                  View source notification
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M6.5 1H9v2.5M9 1 5 5M4 2H2.5A1.5 1.5 0 0 0 1 3.5v5A1.5 1.5 0 0 0 2.5 10h5A1.5 1.5 0 0 0 9 8.5V7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
