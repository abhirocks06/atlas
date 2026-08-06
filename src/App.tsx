import { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import rawData from '../data/fms_notifications.json'
import type { Notification } from './types'
import { WorldMap } from './components/WorldMap'
import { NetworkView } from './components/NetworkView'
import { AnalyticsPage } from './components/AnalyticsPage'
import { CountryPage } from './components/CountryPage'
import { ContractorPage } from './components/ContractorPage'
import { FilterBar, type AppView } from './components/FilterBar'
import { SummaryStats } from './components/SummaryStats'
import { categorize, type WeaponCategory } from './utils/weaponCategories'
import { getNewNotifications } from './utils/newNotifications'
import { NewNotificationBanner } from './components/NewNotificationBanner'
import { getFlagUrl, prefetchFlags } from './utils/countryFlags'
import { prefetchContractorLogos } from './utils/contractorLogos'
import { contractorNames } from './utils/parseContractors'
import { normalizeContractor } from './utils/normalizeContractor'

const allNotifications = rawData as Notification[]

const dates = allNotifications.map(n => n.date).sort()
const DATA_MIN_DATE = dates[0]
const DATA_MAX_DATE = dates[dates.length - 1]

function parseView(param: string | null): AppView {
  if (param === 'network') return 'network'
  // Legacy: trends → analytics
  if (param === 'analytics' || param === 'trends') return 'analytics'
  return 'map'
}

function getInitialState() {
  const params = new URLSearchParams(window.location.search)
  const view = parseView(params.get('view'))
  const country = params.get('country') || null
  const contractorRaw = params.get('contractor') || null
  const contractor = contractorRaw ? normalizeContractor(contractorRaw) : null
  const sale = params.get('sale') || null
  const fromYear = params.get('from')
  const toYear = params.get('to')
  const from = fromYear ? `${fromYear}-01-01` : DATA_MIN_DATE
  const to = toYear ? `${toYear}-12-31` : DATA_MAX_DATE
  const dateRange: [string, string] = [
    from < DATA_MIN_DATE ? DATA_MIN_DATE : from,
    to > DATA_MAX_DATE ? DATA_MAX_DATE : to < DATA_MIN_DATE ? DATA_MAX_DATE : to,
  ]
  // Prefer contractor over country if both somehow present
  if (contractor) {
    return { view, country: null, contractor, sale, dateRange }
  }
  return { view, country, contractor: null, sale, dateRange }
}

/** Stable URL key for a notification (transmittal preferred). */
function saleUrlKey(n: Notification): string {
  if (n.transmittal) return n.transmittal
  return `${n.date}_${n.costUSD ?? 0}`
}

export default function App() {
  const initial = useMemo(getInitialState, [])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(initial.country)
  const [selectedContractor, setSelectedContractor] = useState<string | null>(initial.contractor)
  const [selectedSaleKey, setSelectedSaleKey] = useState<string | null>(initial.sale)
  const [dateRange, setDateRange] = useState<[string, string]>(initial.dateRange)
  const [categoryFilter, setCategoryFilter] = useState<WeaponCategory | null>(null)
  const [view, setView] = useState<AppView>(initial.view)
  const floatingHeaderRef = useRef<HTMLDivElement>(null)
  const [headerClearance, setHeaderClearance] = useState(180)

  useLayoutEffect(() => {
    const el = floatingHeaderRef.current
    if (!el) return
    let cancelled = false

    const measure = () => {
      if (cancelled) return
      const pane = el.parentElement
      if (!pane) return
      // Distance from pane top → bottom of the solid header chrome (+ gap).
      const chrome = (el.firstElementChild as HTMLElement | null) ?? el
      const paneTop = pane.getBoundingClientRect().top
      const bottom = chrome.getBoundingClientRect().bottom
      const next = Math.ceil(bottom - paneTop + 12)
      setHeaderClearance(prev => (prev === next ? prev : next))
    }

    measure()
    // Second pass after layout/fonts settle — avoids a too-short spacer that
    // leaves the first Analytics card clipped under the bar at scrollTop 0.
    const raf = requestAnimationFrame(() => {
      measure()
      requestAnimationFrame(measure)
    })
    void document.fonts?.ready?.then(measure)
    const settled = window.setTimeout(measure, 220)

    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    window.addEventListener('resize', measure)
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      window.clearTimeout(settled)
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [view])

  // Detail pages can leave a window scroll offset; snap back when returning.
  useLayoutEffect(() => {
    if (selectedCountry || selectedContractor) return
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [selectedCountry, selectedContractor])

  const openCountry = (country: string | null) => {
    setSelectedContractor(null)
    setSelectedCountry(country)
    setSelectedSaleKey(null)
  }

  const openContractor = (contractor: string | null) => {
    setSelectedCountry(null)
    setSelectedContractor(contractor)
    setSelectedSaleKey(null)
  }

  // Sync state → URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'map') params.set('view', view)
    if (selectedContractor) params.set('contractor', selectedContractor)
    else if (selectedCountry) params.set('country', selectedCountry)
    if ((selectedCountry || selectedContractor) && selectedSaleKey) params.set('sale', selectedSaleKey)
    const fromYear = dateRange[0].slice(0, 4)
    const toYear = dateRange[1].slice(0, 4)
    if (fromYear !== DATA_MIN_DATE.slice(0, 4)) params.set('from', fromYear)
    if (toYear !== DATA_MAX_DATE.slice(0, 4)) params.set('to', toYear)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [view, selectedCountry, selectedContractor, selectedSaleKey, dateRange])

  // Drop sale key when leaving a detail page
  useEffect(() => {
    if (!selectedCountry && !selectedContractor) setSelectedSaleKey(null)
  }, [selectedCountry, selectedContractor])

  // Prefetch flag images and contractor logos so country pages don't wait on CDN
  useEffect(() => {
    const countries = new Set(
      allNotifications.map(n => n.country).filter((c): c is string => Boolean(c)),
    )
    const contractors = new Set<string>()
    for (const n of allNotifications) {
      for (const name of contractorNames(n.contractor, n.contractorLocation)) {
        contractors.add(name)
      }
    }
    const warm = () => {
      prefetchFlags(countries)
      prefetchFlags(['United States'])
      prefetchContractorLogos(contractors)
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm)
      return () => window.cancelIdleCallback(id)
    }
    const t = window.setTimeout(warm, 150)
    return () => window.clearTimeout(t)
  }, [])

  const filtered = useMemo(() => {
    return allNotifications.filter(n => {
      if (!n.country) return false
      if (n.date < dateRange[0] || n.date > dateRange[1]) return false
      if (categoryFilter && categorize(n.system) !== categoryFilter) return false
      return true
    })
  }, [dateRange, categoryFilter])

  const selectedSale = useMemo(() => {
    if (!selectedSaleKey) return null
    return allNotifications.find(n => saleUrlKey(n) === selectedSaleKey) ?? null
  }, [selectedSaleKey])

  useEffect(() => {
    const viewLabel = view === 'map' ? 'Map' : view === 'network' ? 'Network' : 'Analytics'
    const detail =
      selectedSale?.system
        ? String(selectedSale.system).trim()
        : selectedCountry
          ? selectedCountry
          : selectedContractor
            ? selectedContractor
            : viewLabel

    document.title = `${detail.slice(0, 60)} | Atlas`
  }, [view, selectedCountry, selectedContractor, selectedSale])

  const countryTotals = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>()
    for (const n of filtered) {
      if (!n.country) continue
      const existing = map.get(n.country) ?? { total: 0, count: 0 }
      map.set(n.country, {
        total: existing.total + (n.costUSD ?? 0),
        count: existing.count + 1,
      })
    }
    return map
  }, [filtered])

  const contractorOptions = useMemo(() => {
    const set = new Set<string>()
    for (const n of filtered) {
      for (const name of contractorNames(n.contractor, n.contractorLocation)) {
        set.add(name)
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [filtered])

  const selectedNotifications = useMemo(() => {
    if (!selectedCountry) return []
    return allNotifications.filter(n =>
      n.country === selectedCountry &&
      n.date >= dateRange[0] &&
      n.date <= dateRange[1]
    )
  }, [selectedCountry, dateRange])

  const contractorNotifications = useMemo(() => {
    if (!selectedContractor) return []
    return allNotifications.filter(n => {
      if (n.date < dateRange[0] || n.date > dateRange[1]) return false
      return contractorNames(n.contractor, n.contractorLocation).includes(selectedContractor)
    })
  }, [selectedContractor, dateRange])

  const [todayKey, setTodayKey] = useState(() => new Date().toDateString())

  useEffect(() => {
    const tick = () => {
      const next = new Date().toDateString()
      setTodayKey(prev => (prev === next ? prev : next))
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const newNotifications = useMemo(
    () => getNewNotifications(allNotifications),
    [todayKey],
  )

  const drillIn = Boolean(selectedCountry || selectedContractor)

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#080808]">
    <NewNotificationBanner
      notifications={newNotifications}
      onSelect={openCountry}
    />
    {/* Keep map/network mounted under detail pages so back-nav doesn't remount
        the header spacer and shove the diagram up with empty space below. */}
    <div className="relative flex-1 min-h-0 overflow-hidden">
      <div
        className={`absolute inset-0 bg-[#0a0c10] ${drillIn ? 'invisible pointer-events-none' : ''}`}
        aria-hidden={drillIn}
      >
        <div
          ref={floatingHeaderRef}
          className="absolute top-0 left-0 right-0 z-20 px-4 md:px-6 pt-4 pb-3 pointer-events-none"
        >
          <div className="pointer-events-auto relative rounded-xl border border-zinc-800/80 bg-[#111111]/90 backdrop-blur-md shadow-lg shadow-black/40">
            <header className="px-4 md:px-6 py-3 sm:py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4 border-b border-zinc-800/60 rounded-t-xl overflow-hidden">
              <div className="flex items-start gap-1.5 sm:gap-2 md:gap-3 min-w-0 sm:flex-1 sm:items-center overflow-hidden">
                {getFlagUrl('United States') && (
                  <img
                    src={getFlagUrl('United States')!}
                    alt="United States"
                    title="United States"
                    className="block h-6 sm:h-7 w-auto shrink-0 mt-0.5 sm:mt-0"
                    decoding="async"
                    draggable={false}
                  />
                )}
                <div className="w-px h-4 sm:h-5 bg-zinc-700 shrink-0 mt-1 sm:mt-0 self-start sm:self-center" />
                <div className="min-w-0 overflow-hidden">
                  <p className="text-[10px] md:text-xs font-normal tracking-widest uppercase text-zinc-400 leading-snug">
                    <span className="sm:hidden">U.S. FMS Congressional Notifications</span>
                    <span className="hidden sm:inline">U.S. Foreign Military Sales Congressional Notifications</span>
                  </p>
                  <p className="text-[9px] md:text-[10px] text-zinc-600 mt-0.5 tracking-wide leading-snug">
                    <span className="sm:hidden">Source: DSCA &amp; State Department</span>
                    <span className="hidden sm:inline">Source: Defense Security Cooperation Agency &amp; State Department Bureau of Political-Military Affairs</span>
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-auto sm:shrink-0">
                <SummaryStats filtered={filtered} />
              </div>
            </header>
            <FilterBar
              embedded
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
              minDate={DATA_MIN_DATE}
              maxDate={DATA_MAX_DATE}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              view={view}
              onViewChange={setView}
              countries={Array.from(countryTotals.keys()).sort()}
              contractors={contractorOptions}
              onSelectCountry={openCountry}
              onSelectContractor={openContractor}
            />
          </div>
        </div>

        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            {view === 'map' ? (
              <motion.div
                key="mapview"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <WorldMap
                  countryTotals={countryTotals}
                  selectedCountry={selectedCountry}
                  onSelectCountry={openCountry}
                />
              </motion.div>
            ) : view === 'network' ? (
              <motion.div
                key="networkview"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <NetworkView
                  filtered={filtered}
                  onSelectCountry={openCountry}
                  onSelectContractor={openContractor}
                  headerClearance={headerClearance}
                />
              </motion.div>
            ) : (
              <motion.div
                key="analyticsview"
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <AnalyticsPage
                  notifications={filtered}
                  embedded
                  headerClearance={headerClearance}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {selectedContractor ? (
          <motion.div
            key={`contractor-${selectedContractor}`}
            className="absolute inset-0 z-30 overflow-hidden bg-[#080808]"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <ContractorPage
              contractor={selectedContractor}
              notifications={contractorNotifications}
              initialSaleKey={selectedSaleKey}
              onSaleKeyChange={setSelectedSaleKey}
              onSelectCountry={openCountry}
              onSelectContractor={openContractor}
              onBack={() => openContractor(null)}
            />
          </motion.div>
        ) : selectedCountry ? (
          <motion.div
            key={`country-${selectedCountry}`}
            className="absolute inset-0 z-30 overflow-hidden bg-[#080808]"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <CountryPage
              country={selectedCountry}
              notifications={selectedNotifications}
              initialSaleKey={selectedSaleKey}
              onSaleKeyChange={setSelectedSaleKey}
              onSelectContractor={openContractor}
              onBack={() => openCountry(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
    </div>
  )
}
