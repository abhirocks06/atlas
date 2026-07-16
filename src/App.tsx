import { useState, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import rawData from '../data/fms_notifications.json'
import type { Notification } from './types'
import { WorldMap } from './components/WorldMap'
import { NetworkView } from './components/NetworkView'
import { CountryPage } from './components/CountryPage'
import { ContractorPage } from './components/ContractorPage'
import { FilterBar } from './components/FilterBar'
import { SummaryStats } from './components/SummaryStats'
import { categorize, type WeaponCategory } from './utils/weaponCategories'
import { getNewNotifications } from './utils/newNotifications'
import { NewNotificationBanner } from './components/NewNotificationBanner'
import { prefetchFlags } from './utils/countryFlags'
import { prefetchContractorLogos } from './utils/contractorLogos'
import { contractorNames } from './utils/parseContractors'

const allNotifications = rawData as Notification[]

const dates = allNotifications.map(n => n.date).sort()
const DATA_MIN_DATE = dates[0]
const DATA_MAX_DATE = dates[dates.length - 1]

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 3.5l4-1.5 4 1.5 4-1.5v9l-4 1.5-4-1.5-4 1.5v-9z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
      <path d="M5 2v9M9 3.5v9" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  )
}

function NetworkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="2.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="2.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="11.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <circle cx="11.5" cy="10" r="1.5" stroke="currentColor" strokeWidth="1.1"/>
      <path d="M4 4h5.5M4 10h5.5M4 4.5L9.5 9.5M4 9.5L9.5 4.5" stroke="currentColor" strokeWidth="0.9" strokeOpacity="0.6"/>
    </svg>
  )
}

function getInitialState() {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view') === 'network' ? 'network' : 'map'
  const country = params.get('country') || null
  const contractor = params.get('contractor') || null
  const sale = params.get('sale') || null
  const fromYear = params.get('from')
  const toYear = params.get('to')
  const dateRange: [string, string] = [
    fromYear ? `${fromYear}-01-01` : DATA_MIN_DATE,
    toYear ? `${toYear}-12-31` : DATA_MAX_DATE,
  ]
  // Prefer contractor over country if both somehow present
  return { view, country: contractor ? null : country, contractor, sale, dateRange }
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
  const [view, setView] = useState<'map' | 'network'>(initial.view as 'map' | 'network')

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

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#0f0f0f]">
    <NewNotificationBanner
      notifications={newNotifications}
      onSelect={openCountry}
    />
    <AnimatePresence mode="wait">
      {selectedContractor ? (
        <motion.div
          key={`contractor-${selectedContractor}`}
          className="flex-1 min-h-0 overflow-hidden bg-[#0f0f0f]"
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
            onBack={() => openContractor(null)}
          />
        </motion.div>
      ) : selectedCountry ? (
        <motion.div
          key={`country-${selectedCountry}`}
          className="flex-1 min-h-0 overflow-hidden bg-[#0f0f0f]"
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
      ) : (
        <motion.div
          key="map"
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
        >
          <header className="px-4 md:px-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 min-h-14 py-2 bg-[#0d0d0d]">
            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1 mr-3">
              <a href="https://maenad.vercel.app" target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                <img src="/icon-only.svg" alt="Maenad" width={22} height={22} className="select-none" draggable={false} />
              </a>
              <div className="w-px h-5 bg-zinc-800 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs font-normal tracking-widest uppercase text-zinc-400">
                  <span className="sm:hidden">Atlas</span>
                  <span className="hidden sm:inline truncate">Atlas | U.S. Foreign Military Sales Congressional Notifications</span>
                </div>
                <div className="text-[8px] sm:text-[9px] md:text-[10px] text-zinc-600 mt-0.5 tracking-wide leading-snug">
                  <span className="sm:hidden">Source: DSCA &amp; Department of State</span>
                  <span className="hidden sm:inline">Source: Defense Security Cooperation Agency &amp; Department of State Bureau of Political-Military Affairs</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <SummaryStats filtered={filtered} />
            </div>
          </header>

          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            minDate={DATA_MIN_DATE}
            maxDate={DATA_MAX_DATE}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            view={view}
            onViewChange={setView}
            countries={Array.from(countryTotals.keys()).sort()}
            onSelectCountry={openCountry}
          />

          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {view === 'map' ? (
                <motion.div
                  key="mapview"
                  className="w-full h-full"
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
              ) : (
                <motion.div
                  key="networkview"
                  className="w-full h-full"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <NetworkView
                    filtered={filtered}
                    onSelectCountry={openCountry}
                    onSelectContractor={openContractor}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  )
}
