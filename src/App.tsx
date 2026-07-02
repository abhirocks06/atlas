import { useState, useMemo, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import rawData from '../data/fms_notifications.json'
import type { Notification } from './types'
import { WorldMap } from './components/WorldMap'
import { NetworkView } from './components/NetworkView'
import { CountryPage } from './components/CountryPage'
import { FilterBar } from './components/FilterBar'
import { SummaryStats } from './components/SummaryStats'
import { categorize, type WeaponCategory } from './utils/weaponCategories'
import { getRegion, type Region } from './utils/countryRegions'
import { getNewNotifications } from './utils/newNotifications'
import { NewNotificationBanner } from './components/NewNotificationBanner'

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
  const region = (params.get('region') as Region) || null
  const fromYear = params.get('from')
  const toYear = params.get('to')
  const dateRange: [string, string] = [
    fromYear ? `${fromYear}-01-01` : DATA_MIN_DATE,
    toYear ? `${toYear}-12-31` : DATA_MAX_DATE,
  ]
  return { view, country, region, dateRange }
}

export default function App() {
  const initial = useMemo(getInitialState, [])
  const [selectedCountry, setSelectedCountry] = useState<string | null>(initial.country)
  const [dateRange, setDateRange] = useState<[string, string]>(initial.dateRange)
  const [categoryFilter, setCategoryFilter] = useState<WeaponCategory | null>(null)
  const [regionFilter, setRegionFilter] = useState<Region | null>(initial.region)
  const [view, setView] = useState<'map' | 'network'>(initial.view as 'map' | 'network')

  // Sync state → URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (view !== 'map') params.set('view', view)
    if (selectedCountry) params.set('country', selectedCountry)
    if (regionFilter) params.set('region', regionFilter)
    const fromYear = dateRange[0].slice(0, 4)
    const toYear = dateRange[1].slice(0, 4)
    if (fromYear !== DATA_MIN_DATE.slice(0, 4)) params.set('from', fromYear)
    if (toYear !== DATA_MAX_DATE.slice(0, 4)) params.set('to', toYear)
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [view, selectedCountry, regionFilter, dateRange])

  const filtered = useMemo(() => {
    return allNotifications.filter(n => {
      if (!n.country) return false
      if (n.date < dateRange[0] || n.date > dateRange[1]) return false
      if (categoryFilter && categorize(n.system) !== categoryFilter) return false
      if (regionFilter && getRegion(n.country) !== regionFilter) return false
      return true
    })
  }, [dateRange, categoryFilter, regionFilter])

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

  const newNotifications = useMemo(() => getNewNotifications(allNotifications), [])

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden bg-[#0f0f0f]">
    <NewNotificationBanner
      notifications={newNotifications}
      onSelect={setSelectedCountry}
    />
    <AnimatePresence mode="wait">
      {selectedCountry ? (
        <motion.div
          key="country"
          className="flex-1 min-h-0 overflow-hidden bg-[#0f0f0f]"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          <CountryPage
            country={selectedCountry}
            notifications={selectedNotifications}
            onBack={() => setSelectedCountry(null)}
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
          <header className="px-4 md:px-5 border-b border-zinc-800 flex items-center justify-between flex-shrink-0 h-14 bg-[#0d0d0d]">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <a href="https://atlas-fms.vercel.app" target="_blank" rel="noopener noreferrer" className="shrink-0 opacity-80 hover:opacity-100 transition-opacity">
                <img src="/icon-only.svg" alt="Maenad" width={22} height={22} className="select-none" draggable={false} />
              </a>
              <div className="w-px h-5 bg-zinc-800 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] md:text-xs font-normal tracking-widest uppercase text-zinc-400">
                  <span className="sm:hidden">Atlas</span>
                  <span className="hidden sm:inline truncate">Atlas | U.S. FOREIGN MILITARY SALES</span>
                </div>
                <div className="text-[9px] md:text-[10px] text-zinc-600 mt-0.5 tracking-wide hidden sm:block">
                  Source: Defense Security Cooperation Agency &amp; State Dept. Bureau of Political-Military Affairs
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
            regionFilter={regionFilter}
            onRegionFilterChange={setRegionFilter}
            view={view}
            onViewChange={setView}
            countries={Array.from(countryTotals.keys()).sort()}
            onSelectCountry={setSelectedCountry}
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
                    onSelectCountry={setSelectedCountry}
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
                    onSelectCountry={(c) => { setSelectedCountry(c) }}
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
