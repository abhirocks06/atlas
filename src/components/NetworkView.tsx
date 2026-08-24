import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import type { Notification } from '../types'
import { contractorNames } from '../utils/parseContractors'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, getContractorInitials } from '../utils/contractorLogos'
import { getSystemFamily } from '../utils/systemFamily'
import { categorize, type WeaponCategory } from '../utils/weaponCategories'

interface Props {
  filtered: Notification[]
  focus?: NetworkFocus[]
  onClearFocus?: () => void
  onFocus?: (focus: NetworkFocus, additive: boolean) => void
  onSelectCountry?: (country: string) => void
  onSelectContractor?: (contractor: string) => void
  /** Measured bottom of floating header (px) — keeps diagram below the bar */
  headerClearance?: number
}

export type NetworkFocus =
  | { type: 'system'; id: string }
  | { type: 'country'; name: string }
  | { type: 'contractor'; name: string }

export function sameNetworkFocus(a: NetworkFocus, b: NetworkFocus): boolean {
  if (a.type !== b.type) return false
  if (a.type === 'system' && b.type === 'system') return a.id === b.id
  if (a.type === 'country' && b.type === 'country') return a.name === b.name
  if (a.type === 'contractor' && b.type === 'contractor') return a.name === b.name
  return false
}

type InteractionItem = Exclude<Hover, null>

/** Contractors → Equipment → USG → Countries — thresholded preview, full data on focus. */
const VB_W = 1760
const VB_H = 880
const PAD_Y = 36

const ROW_GAP = 2
/** Shrink rows only when a column has so many items they'd overflow the view. */
const ROW_H_FLOOR = 12

/** Approx width of one character at 11px system-ui (slightly generous to avoid clipping). */
const CHAR_W = 6.6
const DENSE_CHAR_W = 6.0
const BOX_MIN_W = 112
const BOX_PAD_RIGHT = 12

const EDGE = 48
const LABEL_OFFSET = 18
const COL_LANE_GAP = 28
const U_W = 118
const U_H = 72
/** Recurring primes only — notice count; no dollar floor. */
const MIN_CONTRACTOR_ENTRIES = 10
const MIN_EQUIPMENT_VALUE = 10e9
const MIN_COUNTRY_VALUE = 15e9

const US_LABEL = 'United States of America'

type Hover =
  | { type: 'contractor'; name: string }
  | { type: 'system'; id: string }
  | { type: 'usg' }
  | { type: 'country'; name: string }
  | null

type NodeRow = { id: string; label: string; value: number }

function equipmentFor(system: string | null | undefined): { id: string; label: string; category: WeaponCategory } {
  const category = categorize(system ?? null)
  const fam = getSystemFamily(system)
  if (fam) return { id: fam.id, label: fam.label, category }
  return { id: `cat:${category}`, label: category, category }
}

function boxWidthFor(
  labels: Array<{ label: string; leftPad: number }>,
  charW = CHAR_W,
): number {
  let max = BOX_MIN_W
  for (const { label, leftPad } of labels) {
    max = Math.max(max, leftPad + Math.ceil(label.length * charW) + BOX_PAD_RIGHT)
  }
  return max
}

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`
}

/** Row height — fill the column; only shrink when necessary. */
function rowH(count: number, targetH: number, gap: number) {
  if (count <= 0) return 32
  return Math.max(ROW_H_FLOOR, (targetH - (count - 1) * gap) / count)
}

function rowFontSize(h: number): number {
  if (h >= 36) return 11
  if (h >= 28) return 10
  if (h >= 20) return 9
  return 8
}

function rowLogoSize(h: number): number {
  return Math.min(20, Math.max(10, h - 8))
}

function rowFlagH(h: number): number {
  return Math.min(14, Math.max(8, h - 10))
}

function rowRx(h: number): number {
  return h >= 32 ? 6 : 4
}

function columnYsFrom(count: number, boxH: number, boxGap: number, startY: number) {
  return Array.from({ length: count }, (_, i) => startY + i * (boxH + boxGap))
}

function filterByValue<T extends { value: number }>(
  ranked: T[],
  minValue: number,
): T[] {
  return ranked.filter(item => item.value >= minValue)
}

function filterByMinEntries<T extends { count: number }>(
  ranked: T[],
  minEntries: number,
): T[] {
  return ranked.filter(item => item.count >= minEntries)
}

function sortByValue(rows: NodeRow[]): NodeRow[] {
  return [...rows].sort((a, b) => b.value - a.value)
}

/** Focus target missing from overview — merge in and re-sort by value. */
function ensureInColumn(base: NodeRow[], focusId: string, pool: NodeRow[]): NodeRow[] {
  if (base.some(r => r.id === focusId)) return base
  const row = pool.find(r => r.id === focusId)
  return row ? sortByValue([...base, row]) : base
}

/** Add related rows to a column without removing existing preview cards. */
function mergeRelated(
  base: NodeRow[],
  ids: Set<string> | undefined,
  pool: NodeRow[],
): NodeRow[] {
  if (!ids?.size) return base
  const have = new Set(base.map(r => r.id))
  const extra = [...ids]
    .filter(id => !have.has(id))
    .map(id => pool.find(r => r.id === id))
    .filter((r): r is NodeRow => r != null)
  return extra.length ? sortByValue([...base, ...extra]) : base
}

/** Preview — extend a column with next-ranked items until it matches `count`. */
function padToCount(base: NodeRow[], pool: NodeRow[], count: number): NodeRow[] {
  const sorted = sortByValue(base)
  if (sorted.length >= count) return sorted.slice(0, count)
  const have = new Set(sorted.map(r => r.id))
  const extra = sortByValue(pool.filter(r => !have.has(r.id)))
  return sortByValue([...sorted, ...extra.slice(0, count - sorted.length)])
}

function cardTextLayout(
  y: number,
  h: number,
  boxX: number,
  boxW: number,
  labelX: number,
) {
  return {
    nameY: y + h / 2,
    nameClipW: Math.max(12, boxW - (labelX - boxX) - 8),
  }
}

function hoverKey(h: Hover): string | null {
  if (!h) return null
  if (h.type === 'contractor') return `c:${h.name}`
  if (h.type === 'system') return `s:${h.id}`
  if (h.type === 'country') return `k:${h.name}`
  return 'usg'
}

function expandContractorsColumn(
  base: NodeRow[],
  items: InteractionItem[],
  allContractors: NodeRow[],
  systemContractors: Map<string, Set<string>>,
  contractorCountries: Map<string, Set<string>>,
): NodeRow[] {
  let result = base
  for (const item of items) {
    if (item.type === 'usg') continue
    if (item.type === 'contractor') {
      result = ensureInColumn(result, item.name, allContractors)
    } else if (item.type === 'system') {
      result = mergeRelated(result, systemContractors.get(item.id), allContractors)
    } else {
      const ids = new Set<string>()
      for (const [c, ks] of contractorCountries) {
        if (ks.has(item.name)) ids.add(c)
      }
      result = mergeRelated(result, ids, allContractors)
    }
  }
  return result
}

function expandSystemsColumn(
  base: NodeRow[],
  items: InteractionItem[],
  allSystems: NodeRow[],
  contractorSystems: Map<string, Set<string>>,
  countrySystems: Map<string, Set<string>>,
): NodeRow[] {
  let result = base
  for (const item of items) {
    if (item.type === 'usg') continue
    if (item.type === 'system') {
      result = ensureInColumn(result, item.id, allSystems)
    } else if (item.type === 'contractor') {
      result = mergeRelated(result, contractorSystems.get(item.name), allSystems)
    } else {
      result = mergeRelated(result, countrySystems.get(item.name), allSystems)
    }
  }
  return result
}

function expandCountriesColumn(
  base: NodeRow[],
  items: InteractionItem[],
  allCountries: NodeRow[],
  systemCountries: Map<string, Set<string>>,
  contractorCountries: Map<string, Set<string>>,
): NodeRow[] {
  let result = base
  for (const item of items) {
    if (item.type === 'usg') continue
    if (item.type === 'country') {
      result = ensureInColumn(result, item.name, allCountries)
    } else if (item.type === 'system') {
      result = mergeRelated(result, systemCountries.get(item.id), allCountries)
    } else {
      result = mergeRelated(result, contractorCountries.get(item.name), allCountries)
    }
  }
  return result
}

function unionSets<T>(sets: Array<Set<T>>): Set<T> {
  const out = new Set<T>()
  for (const s of sets) for (const v of s) out.add(v)
  return out
}

export function NetworkView({
  filtered,
  focus = [],
  onClearFocus,
  onFocus,
  onSelectCountry,
  onSelectContractor,
  headerClearance = 180,
}: Props) {
  const [hovered, setHovered] = useState<Hover>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const syncMobile = () => setIsMobile(mq.matches)
    syncMobile()
    mq.addEventListener('change', syncMobile)
    return () => mq.removeEventListener('change', syncMobile)
  }, [])

  useEffect(() => {
    const sync = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element | null }
      const apiFs = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement)
      // F11 / chrome-hidden: viewport fills the screen even without Fullscreen API.
      const chromeGone = window.innerHeight >= screen.availHeight - 8
      setIsFullscreen(apiFs || chromeGone)
    }
    sync()
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    window.addEventListener('resize', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])

  // Mobile only: d3 pinch/pan on the SVG <g> (crisp vectors — not CSS scale)
  useEffect(() => {
    const svgEl = svgRef.current
    const gEl = gRef.current
    if (!svgEl || !gEl) return

    const svg = select(svgEl)
    const g = select(gEl)

    if (!isMobile) {
      g.attr('transform', null)
      svg.on('.zoom', null)
      return
    }

    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.45, 8])
      .clickDistance(8)
      .filter((event) => {
        if (event.type === 'wheel') return true
        if (event.type === 'dblclick') return false
        return (!event.ctrlKey || event.type === 'wheel') && !event.button
      })
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
        const src = event.sourceEvent
        if (src && (src.type === 'touchmove' || src.type === 'mousemove' || src.type === 'wheel')) {
          suppressClickRef.current = true
        }
      })

    svg.call(zoomBehavior)
    svg.call(zoomBehavior.transform, zoomIdentity)
    return () => {
      svg.on('.zoom', null)
    }
  }, [isMobile])

  const clearHover = () => setHovered(null)

  const selectHover = (next: Exclude<Hover, null>) => {
    setHovered(next)
  }

  /** Desktop: open immediately. Mobile: first tap highlights, second tap opens. */
  const handleOpenableTap = (
    next: Extract<Hover, { type: 'contractor' } | { type: 'country' }>,
    open: () => void,
  ) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (!isMobile) {
      open()
      return
    }
    if (hoverKey(hovered) === hoverKey(next)) open()
    else selectHover(next)
  }

  const graph = useMemo(() => {
    const cValue = new Map<string, number>()
    const cCount = new Map<string, number>()
    const sMeta = new Map<string, { label: string; category: WeaponCategory; value: number; count: number }>()
    const kValue = new Map<string, number>()
    const kCount = new Map<string, number>()
    const triple = new Map<string, number>()

    for (const n of filtered) {
      if (!n.country || !n.costUSD) continue
      const names = contractorNames(n.contractor, n.contractorLocation)
      if (names.length === 0) continue
      const eq = equipmentFor(n.system)
      const share = n.costUSD / names.length

      kValue.set(n.country, (kValue.get(n.country) ?? 0) + n.costUSD)
      kCount.set(n.country, (kCount.get(n.country) ?? 0) + 1)

      const sPrev = sMeta.get(eq.id)
      if (sPrev) {
        sPrev.value += n.costUSD
        sPrev.count += 1
      } else {
        sMeta.set(eq.id, { label: eq.label, category: eq.category, value: n.costUSD, count: 1 })
      }

      for (const c of names) {
        cValue.set(c, (cValue.get(c) ?? 0) + share)
        cCount.set(c, (cCount.get(c) ?? 0) + 1)
        triple.set(`${c}::${eq.id}::${n.country}`, (triple.get(`${c}::${eq.id}::${n.country}`) ?? 0) + share)
      }
    }

    const contractorsRanked = [...cValue.entries()]
      .map(([name, value]) => ({ name, value, count: cCount.get(name) ?? 0 }))
      .sort((a, b) => b.value - a.value)

    const systemsRanked = [...sMeta.entries()]
      // Skip category catch-alls ("Aircraft", "Naval Systems", …) — they look like
      // platforms next to F-35 / Black Hawk but are just unmapped leftovers.
      .filter(([id]) => !id.startsWith('cat:'))
      .map(([id, meta]) => ({ id, label: meta.label, value: meta.value, count: meta.count }))
      .sort((a, b) => b.value - a.value)

    const countriesRanked = [...kValue.entries()]
      .map(([name, value]) => ({ name, value, count: kCount.get(name) ?? 0 }))
      .sort((a, b) => b.value - a.value)

    const featS = filterByValue(systemsRanked, MIN_EQUIPMENT_VALUE)
    const featK = filterByValue(countriesRanked, MIN_COUNTRY_VALUE)
    const featSSet = new Set(featS.map(s => s.id))

    // Also require a ≥$10B equipment link so contractor→country paths can continue.
    const contractorsWithFeaturedEq = new Set<string>()
    for (const key of triple.keys()) {
      const [c, s] = key.split('::') as [string, string, string]
      if (featSSet.has(s)) contractorsWithFeaturedEq.add(c)
    }
    const featC = filterByMinEntries(contractorsRanked, MIN_CONTRACTOR_ENTRIES)
      .filter(c => contractorsWithFeaturedEq.has(c.name))

    const contractors: NodeRow[] = featC.map(c => ({ id: c.name, label: c.name, value: c.value }))
    const systems: NodeRow[] = featS.map(s => ({ id: s.id, label: s.label, value: s.value }))
    const countries: NodeRow[] = featK.map(k => ({ id: k.name, label: k.name, value: k.value }))
    // Only contractors with ≥1 named equipment link — services-only primes are orphans here.
    const linkedContractorIds = new Set<string>()
    for (const key of triple.keys()) {
      const [c, s] = key.split('::') as [string, string, string]
      if (!s.startsWith('cat:')) linkedContractorIds.add(c)
    }
    const allContractors: NodeRow[] = contractorsRanked
      .filter(c => linkedContractorIds.has(c.name))
      .map(c => ({ id: c.name, label: c.name, value: c.value }))
    const allSystems: NodeRow[] = systemsRanked.map(s => ({ id: s.id, label: s.label, value: s.value }))
    const allCountries: NodeRow[] = countriesRanked.map(k => ({ id: k.name, label: k.name, value: k.value }))

    const contractorSystems = new Map<string, Set<string>>()
    const systemCountries = new Map<string, Set<string>>()
    const systemContractors = new Map<string, Set<string>>()
    const countrySystems = new Map<string, Set<string>>()
    const contractorCountries = new Map<string, Set<string>>()
    const csValues = new Map<string, number>()
    const scValues = new Map<string, number>()

    for (const [key, value] of triple) {
      const [cRaw, sRaw, kRaw] = key.split('::') as [string, string, string]
      if (sRaw.startsWith('cat:')) continue

      csValues.set(`${cRaw}::${sRaw}`, (csValues.get(`${cRaw}::${sRaw}`) ?? 0) + value)
      scValues.set(`${sRaw}::${kRaw}`, (scValues.get(`${sRaw}::${kRaw}`) ?? 0) + value)

      if (!contractorSystems.has(cRaw)) contractorSystems.set(cRaw, new Set())
      contractorSystems.get(cRaw)!.add(sRaw)
      if (!systemContractors.has(sRaw)) systemContractors.set(sRaw, new Set())
      systemContractors.get(sRaw)!.add(cRaw)
      if (!systemCountries.has(sRaw)) systemCountries.set(sRaw, new Set())
      systemCountries.get(sRaw)!.add(kRaw)
      if (!countrySystems.has(kRaw)) countrySystems.set(kRaw, new Set())
      countrySystems.get(kRaw)!.add(sRaw)
      if (!contractorCountries.has(cRaw)) contractorCountries.set(cRaw, new Set())
      contractorCountries.get(cRaw)!.add(kRaw)
    }

    const csEdges = [...csValues.entries()].map(([key, value]) => {
      const [contractor, systemId] = key.split('::') as [string, string]
      return { contractor, systemId, value }
    })
    const scEdges = [...scValues.entries()].map(([key, value]) => {
      const [systemId, country] = key.split('::') as [string, string]
      return { systemId, country, value }
    })

    const suValues = new Map<string, number>()
    const ukValues = new Map<string, number>()
    for (const [key, value] of scValues) {
      const [systemId, country] = key.split('::') as [string, string]
      suValues.set(systemId, (suValues.get(systemId) ?? 0) + value)
      ukValues.set(country, (ukValues.get(country) ?? 0) + value)
    }

    return {
      contractors,
      systems,
      countries,
      allContractors,
      allSystems,
      allCountries,
      contractorSystems,
      systemCountries,
      systemContractors,
      countrySystems,
      contractorCountries,
      csEdges,
      scEdges,
      suValues,
      ukValues,
    }
  }, [filtered])

  const {
    contractors,
    systems,
    countries,
    allContractors,
    allSystems,
    allCountries,
    contractorSystems,
    systemCountries,
    systemContractors,
    countrySystems,
    contractorCountries,
    csEdges,
    suValues,
    ukValues,
  } = graph

  const focusList = focus
  const expansionItems = useMemo((): InteractionItem[] => {
    if (focusList.length > 0) return focusList
    return hovered ? [hovered] : []
  }, [focusList, hovered])

  /** Stable preview columns — same rows/heights in focus unless the target was missing. */
  const columnCount = countries.length
  const previewContractors = useMemo(
    () => padToCount(contractors, allContractors, columnCount),
    [contractors, allContractors, columnCount],
  )
  const previewSystems = useMemo(
    () => padToCount(systems, allSystems, columnCount),
    [systems, allSystems, columnCount],
  )
  const previewCountries = useMemo(
    () => sortByValue(countries),
    [countries],
  )

  const displayContractors = useMemo(() => {
    if (expansionItems.length === 0 || expansionItems.every(i => i.type === 'usg')) {
      return previewContractors
    }
    return expandContractorsColumn(
      previewContractors,
      expansionItems,
      allContractors,
      systemContractors,
      contractorCountries,
    )
  }, [expansionItems, previewContractors, allContractors, systemContractors, contractorCountries])

  const displaySystems = useMemo(() => {
    if (expansionItems.length === 0 || expansionItems.every(i => i.type === 'usg')) {
      return previewSystems
    }
    return expandSystemsColumn(
      previewSystems,
      expansionItems,
      allSystems,
      contractorSystems,
      countrySystems,
    )
  }, [expansionItems, previewSystems, allSystems, contractorSystems, countrySystems])

  const displayCountries = useMemo(() => {
    if (expansionItems.length === 0 || expansionItems.every(i => i.type === 'usg')) {
      return previewCountries
    }
    return expandCountriesColumn(
      previewCountries,
      expansionItems,
      allCountries,
      systemCountries,
      contractorCountries,
    )
  }, [expansionItems, previewCountries, allCountries, systemCountries, contractorCountries])

  const inFocusMode = focusList.length > 0
  const inHighlightMode = focusList.length > 0 || hovered != null

  let C_W = boxWidthFor(
    previewContractors.map(c => ({
      label: c.label,
      leftPad: 36,
    })),
  )
  let S_W = boxWidthFor(
    displaySystems.map(s => ({ label: s.label, leftPad: 12 })),
    DENSE_CHAR_W,
  )
  let K_W = boxWidthFor(
    displayCountries.map(k => ({
      label: k.label,
      leftPad: !getFlagUrl(k.label, 160) ? 12 : 34,
    })),
    DENSE_CHAR_W,
  )

  const C_X = EDGE
  const K_X = VB_W - EDGE - K_W
  const MID_START = C_X + C_W
  const MID_END = K_X
  const MID_REST = Math.max(120, MID_END - MID_START - U_W - S_W)
  const GAP_CS = MID_REST * 0.48
  const GAP_SU = (MID_REST - GAP_CS) / 2
  const S_X = MID_START + GAP_CS
  const U_X = S_X + S_W + GAP_SU

  // Cap side column widths so long labels clip instead of shifting other lanes.
  C_W = Math.min(C_W, Math.max(BOX_MIN_W, S_X - COL_LANE_GAP - C_X))
  K_W = Math.min(K_W, Math.max(BOX_MIN_W, K_X - (U_X + U_W + COL_LANE_GAP)))

  // Each column always fills targetH — row height shrinks when a column has more cards.
  const targetH = VB_H - PAD_Y * 2
  const colStart = PAD_Y
  const C_H = rowH(displayContractors.length, targetH, ROW_GAP)
  const S_H = rowH(displaySystems.length, targetH, ROW_GAP)
  const K_H = rowH(displayCountries.length, targetH, ROW_GAP)

  const U_Y = (VB_H - U_H) / 2
  const usgMidY = U_Y + U_H / 2

  const cYs = columnYsFrom(displayContractors.length, C_H, ROW_GAP, colStart)
  const sYs = columnYsFrom(displaySystems.length, S_H, ROW_GAP, colStart)
  const kYs = columnYsFrom(displayCountries.length, K_H, ROW_GAP, colStart)

  const sIndex = new Map(displaySystems.map((s, i) => [s.id, i]))
  const cIndex = new Map(displayContractors.map((c, i) => [c.id, i]))

  const displayCSet = new Set(displayContractors.map(c => c.id))
  const displaySSet = new Set(displaySystems.map(s => s.id))

  const visibleCsEdges = csEdges.filter(
    e => displayCSet.has(e.contractor) && displaySSet.has(e.systemId),
  )

  const activeSystems = useMemo((): Set<string> | null => {
    if (focusList.length > 0) {
      return unionSets(focusList.map(f => {
        if (f.type === 'system') return new Set([f.id])
        if (f.type === 'country') return countrySystems.get(f.name) ?? new Set<string>()
        return contractorSystems.get(f.name) ?? new Set<string>()
      }))
    }
    if (!hovered) return null
    if (hovered.type === 'usg') return new Set(displaySystems.map(s => s.id))
    if (hovered.type === 'system') return new Set([hovered.id])
    if (hovered.type === 'country') return countrySystems.get(hovered.name) ?? new Set<string>()
    return contractorSystems.get(hovered.name) ?? new Set<string>()
  }, [focusList, hovered, contractorSystems, countrySystems, displaySystems])

  const activeContractors = useMemo((): Set<string> | null => {
    if (focusList.length > 0) {
      return unionSets(focusList.map(f => {
        if (f.type === 'contractor') return new Set([f.name])
        if (f.type === 'system') return systemContractors.get(f.id) ?? new Set<string>()
        const set = new Set<string>()
        for (const [c, ks] of contractorCountries) {
          if (ks.has(f.name)) set.add(c)
        }
        return set
      }))
    }
    if (!hovered) return null
    if (hovered.type === 'usg') return new Set(displayContractors.map(c => c.id))
    if (hovered.type === 'contractor') return new Set([hovered.name])
    if (hovered.type === 'system') return systemContractors.get(hovered.id) ?? new Set<string>()
    const set = new Set<string>()
    for (const [c, ks] of contractorCountries) {
      if (ks.has(hovered.name)) set.add(c)
    }
    return set
  }, [focusList, hovered, systemContractors, contractorCountries, displayContractors])

  const activeCountries = useMemo((): Set<string> | null => {
    if (focusList.length > 0) {
      return unionSets(focusList.map(f => {
        if (f.type === 'country') return new Set([f.name])
        if (f.type === 'system') return systemCountries.get(f.id) ?? new Set<string>()
        return contractorCountries.get(f.name) ?? new Set<string>()
      }))
    }
    if (!hovered) return null
    if (hovered.type === 'usg') return new Set(displayCountries.map(c => c.id))
    if (hovered.type === 'country') return new Set([hovered.name])
    if (hovered.type === 'system') return systemCountries.get(hovered.id) ?? new Set<string>()
    return contractorCountries.get(hovered.name) ?? new Set<string>()
  }, [focusList, hovered, systemCountries, contractorCountries, displayCountries])

  const usgActive =
    !inHighlightMode ||
    hovered?.type === 'usg' ||
    Boolean(activeSystems?.size && activeCountries?.size)

  const nodeOn = (active: Set<string> | null, id: string) =>
    active == null ? true : active.has(id)

  const maxCs = Math.max(...visibleCsEdges.map(e => e.value), 1)
  const maxSu = Math.max(
    ...displaySystems.map(s => suValues.get(s.id) ?? 0),
    1,
  )
  const maxUk = Math.max(
    ...displayCountries.map(k => ukValues.get(k.id) ?? 0),
    1,
  )

  const usFlagUrl = getFlagUrl(US_LABEL, 160)

  /** Focus/hover: only path edges. Idle: faint skeleton. */
  const edgeOpacity = (kind: 'cs' | 'su' | 'uk', active: boolean) => {
    if (inHighlightMode) return active ? 0.95 : 0
    if (kind === 'cs') return 0.07
    return 0.12
  }

  const showEdge = (active: boolean) => !inHighlightMode || active

  const edgeStroke = (active: boolean) =>
    inHighlightMode && active ? '#e09a45' : '#c4873a'

  const boxOpacity = (active: boolean) => {
    if (inHighlightMode) return active ? 1 : 0.35
    return 1
  }

  const isPinned = (type: NetworkFocus['type'], id: string) =>
    focusList.some(f => {
      if (f.type !== type) return false
      if (f.type === 'system') return f.id === id
      return f.name === id
    })

  useEffect(() => {
    if (focusList.length === 0) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearFocus?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focusList, onClearFocus])

  return (
    <div className="w-full h-full bg-[#0a0c10] flex flex-col overflow-hidden relative select-none">
      <div
        aria-hidden
        className="shrink-0"
        style={{ height: headerClearance + (isFullscreen ? 28 : 0) }}
      />
      <div className={`flex-1 min-h-0 relative ${isMobile ? 'overflow-hidden' : ''}`}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMin meet"
          className={`w-full h-full select-none ${isMobile ? 'touch-none' : ''}`}
          onMouseDown={e => e.preventDefault()}
        >
          <g ref={gRef}>
            {/* Click empty canvas to clear focus / mobile hover */}
            <rect
              x={0}
              y={0}
              width={VB_W}
              height={VB_H}
              fill="transparent"
              onClick={() => {
                if (inFocusMode) onClearFocus?.()
                else if (isMobile) clearHover()
              }}
            />
            {/* Contractor → Equipment */}
            {visibleCsEdges.map(e => {
              const ci = cIndex.get(e.contractor)
              const si = sIndex.get(e.systemId)
              if (ci === undefined || si === undefined) return null
              const active =
                nodeOn(activeContractors, e.contractor) && nodeOn(activeSystems, e.systemId)
              if (!showEdge(active)) return null
              const w = 0.65 + (Math.log(e.value + 1) / Math.log(maxCs + 1)) * 2.6
              const y1 = cYs[ci]! + C_H / 2
              const y2 = sYs[si]! + S_H / 2
              return (
                <motion.path
                  key={`cs-${e.contractor}-${e.systemId}`}
                  d={curve(C_X + C_W, y1, S_X, y2)}
                  fill="none"
                  stroke={edgeStroke(active)}
                  strokeWidth={w}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: edgeOpacity('cs', active) }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}

            {/* Equipment → USG */}
            {displaySystems.map((s, i) => {
              const active = nodeOn(activeSystems, s.id) && usgActive
              if (!showEdge(active)) return null
              const value = suValues.get(s.id) ?? 0
              const w = 1.0 + (Math.log(value + 1) / Math.log(maxSu + 1)) * 3.2
              const y = sYs[i]! + S_H / 2
              return (
                <motion.path
                  key={`su-${s.id}`}
                  d={curve(S_X + S_W, y, U_X, usgMidY)}
                  fill="none"
                  stroke={edgeStroke(active)}
                  strokeWidth={w}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: edgeOpacity('su', active) }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}

            {/* USG → Countries */}
            {displayCountries.map((k, i) => {
              const active = nodeOn(activeCountries, k.id) && usgActive
              if (!showEdge(active)) return null
              const value = ukValues.get(k.id) ?? 0
              const w = 1.0 + (Math.log(value + 1) / Math.log(maxUk + 1)) * 3.2
              const y = kYs[i]! + K_H / 2
              return (
                <motion.path
                  key={`uk-${k.id}`}
                  d={curve(U_X + U_W, usgMidY, K_X, y)}
                  fill="none"
                  stroke={edgeStroke(active)}
                  strokeWidth={w}
                  strokeLinecap="round"
                  style={{ pointerEvents: 'none' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: edgeOpacity('uk', active) }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}

            <text
              x={C_X + C_W / 2}
              y={(cYs[0] ?? PAD_Y) - LABEL_OFFSET}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill="#3a3f4a"
            >
              <tspan letterSpacing="2">CONTRACTORS</tspan>
            </text>
            <text
              x={S_X + S_W / 2}
              y={(sYs[0] ?? PAD_Y) - LABEL_OFFSET}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill="#3a3f4a"
            >
              <tspan letterSpacing="2">EQUIPMENT</tspan>
            </text>
            <text
              x={K_X + K_W / 2}
              y={(kYs[0] ?? PAD_Y) - LABEL_OFFSET}
              textAnchor="middle"
              fontSize={9}
              fontFamily="monospace"
              fill="#3a3f4a"
            >
              <tspan letterSpacing="2">COUNTRIES</tspan>
            </text>

            {displayContractors.map((c, i) => {
              const active = nodeOn(activeContractors, c.id)
              const logoUrl = getContractorLogoUrl(c.label)
              const initials = logoUrl ? null : getContractorInitials(c.label)
              const y = cYs[i]!
              const selected = isPinned('contractor', c.id) || (hovered?.type === 'contractor' && hovered.name === c.id)
              const clickable = Boolean(onFocus || onSelectContractor)
              const logoSize = rowLogoSize(C_H)
              const logoY = y + (C_H - logoSize) / 2
              const textX = C_X + 10 + logoSize + 8
              const layout = cardTextLayout(y, C_H, C_X, C_W, textX)
              const fontSize = rowFontSize(C_H)
              return (
                <g
                  key={c.id}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  onMouseEnter={() => {
                    if (!isMobile && !inFocusMode) setHovered({ type: 'contractor', name: c.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile && !inFocusMode) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    // Second click on the focused contractor → open its page.
                    if (inFocusMode && onSelectContractor && !e.shiftKey && isPinned('contractor', c.id)) {
                      onSelectContractor(c.label)
                      setHovered(null)
                      return
                    }
                    if (onFocus) {
                      onFocus({ type: 'contractor', name: c.id }, e.shiftKey)
                      setHovered(null)
                      return
                    }
                    handleOpenableTap(
                      { type: 'contractor', name: c.id },
                      () => { if (onSelectContractor) onSelectContractor(c.label) },
                    )
                  }}
                >
                  <motion.rect
                    x={C_X} y={y} width={C_W} height={C_H} rx={rowRx(C_H)}
                    fill="#111111"
                    stroke={selected ? '#c4873a' : '#27272a'}
                    strokeWidth={selected ? 1.4 : 1}
                    animate={{ opacity: boxOpacity(active) }}
                    transition={{ duration: 0.15 }}
                  />
                  {logoUrl && logoSize >= 10 ? (
                    <image
                      href={logoUrl}
                      x={C_X + 8} y={logoY}
                      width={logoSize} height={logoSize}
                      opacity={active ? 0.95 : 0.35}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  ) : initials && logoSize >= 10 ? (
                    <>
                      <rect
                        x={C_X + 8} y={logoY}
                        width={logoSize} height={logoSize} rx={2}
                        fill="#27272a"
                        opacity={active ? 0.95 : 0.35}
                      />
                      <text
                        x={C_X + 8 + logoSize / 2}
                        y={logoY + logoSize / 2 + 0.5}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={active ? '#a1a1aa' : '#52525b'}
                        fontSize={Math.max(7, logoSize * 0.42)}
                        fontFamily="system-ui, sans-serif"
                        fontWeight={500}
                      >
                        {initials}
                      </text>
                    </>
                  ) : null}
                  <clipPath id={`clip-c-${i}`}>
                    <rect x={textX} y={y + 1} width={layout.nameClipW} height={C_H - 2} />
                  </clipPath>
                  <text
                    x={textX}
                    y={layout.nameY}
                    clipPath={`url(#clip-c-${i})`}
                    dominantBaseline="central"
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={fontSize}
                    fontFamily="system-ui, sans-serif"
                  >
                    {c.label}
                  </text>
                </g>
              )
            })}

            {displaySystems.map((s, i) => {
              const active = nodeOn(activeSystems, s.id)
              const y = sYs[i]!
              const selected = isPinned('system', s.id) || (hovered?.type === 'system' && hovered.id === s.id)
              const labelX = S_X + 10
              const layout = cardTextLayout(y, S_H, S_X, S_W, labelX)
              const fontSize = rowFontSize(S_H)
              return (
                <g
                  key={s.id}
                  style={{ cursor: onFocus ? 'pointer' : isMobile ? 'pointer' : 'default' }}
                  onMouseEnter={() => {
                    if (!isMobile && !inFocusMode) setHovered({ type: 'system', id: s.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile && !inFocusMode) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    if (onFocus) {
                      onFocus({ type: 'system', id: s.id }, e.shiftKey)
                      setHovered(null)
                      return
                    }
                    if (isMobile) {
                      if (hoverKey(hovered) === `s:${s.id}`) clearHover()
                      else selectHover({ type: 'system', id: s.id })
                    }
                  }}
                >
                  <motion.rect
                    x={S_X} y={y} width={S_W} height={S_H} rx={rowRx(S_H)}
                    fill="#111111"
                    stroke={selected ? '#c4873a' : '#27272a'}
                    strokeWidth={selected ? 1.4 : 1}
                    animate={{ opacity: boxOpacity(active) }}
                    transition={{ duration: 0.15 }}
                  />
                  <clipPath id={`clip-s-${i}`}>
                    <rect x={labelX} y={y + 1} width={layout.nameClipW} height={S_H - 2} />
                  </clipPath>
                  <text
                    x={labelX}
                    y={layout.nameY}
                    clipPath={`url(#clip-s-${i})`}
                    dominantBaseline="central"
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={fontSize}
                    fontFamily="system-ui, sans-serif"
                  >
                    {s.label}
                  </text>
                </g>
              )
            })}

            <g
              style={{ cursor: 'default' }}
              onMouseEnter={() => {
                if (!isMobile && !inFocusMode) setHovered({ type: 'usg' })
              }}
              onMouseLeave={() => {
                if (!isMobile && !inFocusMode) setHovered(null)
              }}
              onClick={e => {
                e.stopPropagation()
                if (suppressClickRef.current) {
                  suppressClickRef.current = false
                  return
                }
                if (isMobile) selectHover({ type: 'usg' })
              }}
            >
              <motion.rect
                x={U_X} y={U_Y} width={U_W} height={U_H} rx={10}
                fill="#111111"
                stroke={hovered?.type === 'usg' ? '#c4873a' : '#27272a'}
                strokeWidth={hovered?.type === 'usg' ? 1.4 : 1}
                animate={{ opacity: boxOpacity(usgActive) }}
                transition={{ duration: 0.15 }}
              />
              {usFlagUrl && (
                <image
                  href={usFlagUrl}
                  x={U_X + (U_W - 44) / 2} y={U_Y + 10}
                  width={44} height={29}
                  opacity={usgActive ? 0.95 : 0.35}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              <text
                x={U_X + U_W / 2} y={U_Y + 56}
                textAnchor="middle"
                dominantBaseline="central"
                fill={usgActive ? '#d4d4d8' : '#52525b'}
                fontSize={11}
                fontFamily="system-ui, sans-serif"
              >
                United States
              </text>
            </g>

            {displayCountries.map((k, i) => {
              const active = nodeOn(activeCountries, k.id)
              const flagUrl = getFlagUrl(k.label, 160)
              const y = kYs[i]!
              const selected = isPinned('country', k.id) || (hovered?.type === 'country' && hovered.name === k.id)
              const flagH = rowFlagH(K_H)
              const flagW = flagH * 1.5
              const flagY = y + (K_H - flagH) / 2
              const textX = K_X + (flagUrl ? 10 + flagW + 6 : 10)
              const layout = cardTextLayout(y, K_H, K_X, K_W, textX)
              const fontSize = rowFontSize(K_H)
              return (
                <g
                  key={k.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    if (!isMobile && !inFocusMode) setHovered({ type: 'country', name: k.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile && !inFocusMode) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    // Second click on the focused country → open its page.
                    if (inFocusMode && onSelectCountry && !e.shiftKey && isPinned('country', k.id)) {
                      onSelectCountry(k.label)
                      setHovered(null)
                      return
                    }
                    if (onFocus) {
                      onFocus({ type: 'country', name: k.id }, e.shiftKey)
                      setHovered(null)
                      return
                    }
                    handleOpenableTap(
                      { type: 'country', name: k.id },
                      () => { if (onSelectCountry) onSelectCountry(k.label) },
                    )
                  }}
                >
                  <motion.rect
                    x={K_X} y={y} width={K_W} height={K_H} rx={rowRx(K_H)}
                    fill="#111111"
                    stroke={selected ? '#c4873a' : '#27272a'}
                    strokeWidth={selected ? 1.4 : 1}
                    animate={{ opacity: boxOpacity(active) }}
                    transition={{ duration: 0.15 }}
                  />
                  {flagUrl && flagH >= 8 && (
                    <image
                      href={flagUrl}
                      x={K_X + 8} y={flagY}
                      width={flagW} height={flagH}
                      opacity={active ? 0.95 : 0.35}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                  <clipPath id={`clip-k-${i}`}>
                    <rect x={textX} y={y + 1} width={layout.nameClipW} height={K_H - 2} />
                  </clipPath>
                  <text
                    x={textX}
                    y={layout.nameY}
                    clipPath={`url(#clip-k-${i})`}
                    dominantBaseline="central"
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={fontSize}
                    fontFamily="system-ui, sans-serif"
                  >
                    {k.label}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
    </div>
  )
}
