import { useMemo, useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import type { Notification } from '../types'
import { contractorNames } from '../utils/parseContractors'
import { formatCost } from '../utils/formatters'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl, getContractorInitials } from '../utils/contractorLogos'
import { getSystemFamily } from '../utils/systemFamily'
import { categorize, type WeaponCategory } from '../utils/weaponCategories'

interface Props {
  filtered: Notification[]
  onSelectCountry: (country: string) => void
  onSelectContractor?: (contractor: string) => void
  /** Measured bottom of floating header (px) — keeps diagram below the bar */
  headerClearance?: number
}

/** Contractors → Equipment → USG → Countries — value-floor overview (no top-N caps) */
const VB_W = 1760
const VB_H = 880
const PAD_Y = 36

const BOX_GAP = 2
const DENSE_GAP = 2
const U_W = 118
const U_H = 96
/** Approx width of one character at 11px system-ui (slightly generous to avoid clipping). */
const CHAR_W = 6.6
const DENSE_CHAR_W = 6.0
const BOX_MIN_W = 112
const BOX_PAD_RIGHT = 12

const EDGE = 72
const LABEL_OFFSET = 18
/**
 * Value floors only — no top-N caps.
 * Equipment ≥$10B: named families that are material.
 */
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

/** Row height so `count` cards (+ gaps) exactly fill `targetH`. */
function boxHToFill(count: number, targetH: number, boxGap: number) {
  if (count <= 0) return 16
  return Math.max(12, (targetH - (count - 1) * boxGap) / count)
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

function valueFloorLabel(usd: number) {
  const b = usd / 1e9
  return `≥ $${Number.isInteger(b) ? b : b.toFixed(1)}B`
}

function hoverKey(h: Hover): string | null {
  if (!h) return null
  if (h.type === 'contractor') return `c:${h.name}`
  if (h.type === 'system') return `s:${h.id}`
  if (h.type === 'country') return `k:${h.name}`
  return 'usg'
}

export function NetworkView({
  filtered,
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
    let total = 0

    for (const n of filtered) {
      if (!n.country || !n.costUSD) continue
      const names = contractorNames(n.contractor, n.contractorLocation)
      if (names.length === 0) continue
      const eq = equipmentFor(n.system)
      const share = n.costUSD / names.length
      total += n.costUSD

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
    const featKSet = new Set(featK.map(k => k.name))

    // Also require a ≥$10B equipment link so contractor→US paths can continue.
    const contractorsWithFeaturedEq = new Set<string>()
    for (const key of triple.keys()) {
      const [c, s] = key.split('::') as [string, string, string]
      if (featSSet.has(s)) contractorsWithFeaturedEq.add(c)
    }
    const featC = filterByMinEntries(contractorsRanked, MIN_CONTRACTOR_ENTRIES)
      .filter(c => contractorsWithFeaturedEq.has(c.name))
    const featCSet = new Set(featC.map(c => c.name))

    const contractors: NodeRow[] = featC.map(c => ({ id: c.name, label: c.name, value: c.value }))
    const systems: NodeRow[] = featS.map(s => ({ id: s.id, label: s.label, value: s.value }))
    const countries: NodeRow[] = featK.map(k => ({ id: k.name, label: k.name, value: k.value }))

    const contractorSystems = new Map<string, Set<string>>()
    const systemCountries = new Map<string, Set<string>>()
    const systemContractors = new Map<string, Set<string>>()
    const countrySystems = new Map<string, Set<string>>()
    const contractorCountries = new Map<string, Set<string>>()
    const csValues = new Map<string, number>()
    const suValues = new Map<string, number>()
    const ukValues = new Map<string, number>()

    for (const [key, value] of triple) {
      const [cRaw, sRaw, kRaw] = key.split('::') as [string, string, string]
      const cFeat = featCSet.has(cRaw)
      const sFeat = featSSet.has(sRaw)
      const kFeat = featKSet.has(kRaw)

      // Spoke weights: full flow for each featured end-node (hidden partners still count).
      if (sFeat) suValues.set(sRaw, (suValues.get(sRaw) ?? 0) + value)
      if (kFeat) ukValues.set(kRaw, (ukValues.get(kRaw) ?? 0) + value)
      // Cross links only among featured contractors ↔ featured equipment.
      if (cFeat && sFeat) {
        csValues.set(`${cRaw}::${sRaw}`, (csValues.get(`${cRaw}::${sRaw}`) ?? 0) + value)
      }

      if (cFeat && sFeat) {
        if (!contractorSystems.has(cRaw)) contractorSystems.set(cRaw, new Set())
        contractorSystems.get(cRaw)!.add(sRaw)
        if (!systemContractors.has(sRaw)) systemContractors.set(sRaw, new Set())
        systemContractors.get(sRaw)!.add(cRaw)
      }
      if (sFeat && kFeat) {
        if (!systemCountries.has(sRaw)) systemCountries.set(sRaw, new Set())
        systemCountries.get(sRaw)!.add(kRaw)
        if (!countrySystems.has(kRaw)) countrySystems.set(kRaw, new Set())
        countrySystems.get(kRaw)!.add(sRaw)
      }
      if (cFeat && kFeat) {
        if (!contractorCountries.has(cRaw)) contractorCountries.set(cRaw, new Set())
        contractorCountries.get(cRaw)!.add(kRaw)
      }
    }

    const csEdges = [...csValues.entries()].map(([key, value]) => {
      const [contractor, systemId] = key.split('::') as [string, string]
      return { contractor, systemId, value }
    })

    return {
      contractors,
      systems,
      countries,
      total,
      contractorSystems,
      systemCountries,
      systemContractors,
      countrySystems,
      contractorCountries,
      suValues,
      ukValues,
      csEdges,
    }
  }, [filtered])

  const {
    contractors,
    systems,
    countries,
    total,
    contractorSystems,
    systemCountries,
    systemContractors,
    countrySystems,
    contractorCountries,
    suValues,
    ukValues,
    csEdges,
  } = graph

  const C_W = boxWidthFor(
    contractors.map(c => ({
      label: c.label,
      leftPad: 36,
    })),
  )
  const S_W = boxWidthFor(
    systems.map(s => ({ label: s.label, leftPad: 12 })),
    DENSE_CHAR_W,
  )
  const K_W = boxWidthFor(
    countries.map(k => ({
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
  const U_Y = (VB_H - U_H) / 2

  // Equal column height: fit everyone into the viewBox (no top-N caps).
  const targetH = VB_H - PAD_Y * 2
  const colStart = PAD_Y
  const C_H = boxHToFill(contractors.length, targetH, BOX_GAP)
  const S_H = boxHToFill(systems.length, targetH, DENSE_GAP)
  const K_H = boxHToFill(countries.length, targetH, DENSE_GAP)
  const compactC = C_H < 26
  const compactS = S_H < 26
  const compactK = K_H < 26

  const cYs = columnYsFrom(contractors.length, C_H, BOX_GAP, colStart)
  const sYs = columnYsFrom(systems.length, S_H, DENSE_GAP, colStart)
  const kYs = columnYsFrom(countries.length, K_H, DENSE_GAP, colStart)

  const sIndex = new Map(systems.map((s, i) => [s.id, i]))
  const cIndex = new Map(contractors.map((c, i) => [c.id, i]))

  const activeSystems = useMemo((): Set<string> | null => {
    if (!hovered) return null
    if (hovered.type === 'system') return new Set([hovered.id])
    if (hovered.type === 'contractor') return contractorSystems.get(hovered.name) ?? new Set<string>()
    if (hovered.type === 'country') return countrySystems.get(hovered.name) ?? new Set<string>()
    return new Set(systems.map(s => s.id))
  }, [hovered, contractorSystems, countrySystems, systems])

  const activeContractors = useMemo((): Set<string> | null => {
    if (!hovered) return null
    if (hovered.type === 'contractor') return new Set([hovered.name])
    if (hovered.type === 'system') return systemContractors.get(hovered.id) ?? new Set<string>()
    if (hovered.type === 'country') {
      const set = new Set<string>()
      for (const [c, ks] of contractorCountries) {
        if (ks.has(hovered.name)) set.add(c)
      }
      return set
    }
    return new Set(contractors.map(c => c.id))
  }, [hovered, systemContractors, contractorCountries, contractors])

  const activeCountries = useMemo((): Set<string> | null => {
    if (!hovered) return null
    if (hovered.type === 'country') return new Set([hovered.name])
    if (hovered.type === 'system') return systemCountries.get(hovered.id) ?? new Set<string>()
    if (hovered.type === 'contractor') return contractorCountries.get(hovered.name) ?? new Set<string>()
    return new Set(countries.map(c => c.id))
  }, [hovered, systemCountries, contractorCountries, countries])

  const nodeOn = (active: Set<string> | null, id: string) =>
    active == null ? true : active.has(id)

  const maxCs = Math.max(...csEdges.map(e => e.value), 1)
  const maxSu = Math.max(...[...suValues.values()], 1)
  const maxUk = Math.max(...[...ukValues.values()], 1)

  /** Idle: faint skeleton. On hover: full path lit, others dimmed. */
  const edgeOpacity = (kind: 'cs' | 'su' | 'uk', active: boolean) => {
    if (!hovered) {
      if (kind === 'cs') return 0.07
      return 0.12
    }
    return active ? 0.95 : 0.04
  }

  const edgeStroke = (active: boolean) =>
    hovered && active ? '#e09a45' : '#c4873a'

  const boxOpacity = (active: boolean) => {
    if (!hovered) return 1
    return active ? 1 : 0.28
  }

  const usFlagUrl = getFlagUrl(US_LABEL, 160)
  const usgMidY = U_Y + U_H / 2

  return (
    <div className="w-full h-full bg-[#0a0c10] flex flex-col overflow-hidden relative">
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
          className={`w-full h-full ${isMobile ? 'touch-none' : ''}`}
        >
          <g ref={gRef}>
            {/* Tap empty canvas to clear mobile selection */}
            <rect
              x={0}
              y={0}
              width={VB_W}
              height={VB_H}
              fill="transparent"
              onClick={() => {
                if (isMobile) clearHover()
              }}
            />
            {/* Contractor → Equipment */}
            {csEdges.map(e => {
              const ci = cIndex.get(e.contractor)
              const si = sIndex.get(e.systemId)
              if (ci === undefined || si === undefined) return null
              const active =
                nodeOn(activeContractors, e.contractor) && nodeOn(activeSystems, e.systemId)
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: edgeOpacity('cs', active) }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}

            {/* Equipment → USG */}
            {systems.map((s, i) => {
              const active = nodeOn(activeSystems, s.id)
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: edgeOpacity('su', active) }}
                  transition={{ duration: 0.15 }}
                />
              )
            })}

            {/* USG → Countries */}
            {countries.map((k, i) => {
              const active = nodeOn(activeCountries, k.id)
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
              <tspan>{` (${MIN_CONTRACTOR_ENTRIES}+ sales)`}</tspan>
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
              <tspan>{` (${valueFloorLabel(MIN_EQUIPMENT_VALUE)})`}</tspan>
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
              <tspan>{` (${valueFloorLabel(MIN_COUNTRY_VALUE)})`}</tspan>
            </text>

            {contractors.map((c, i) => {
              const active = nodeOn(activeContractors, c.id)
              const logoUrl = getContractorLogoUrl(c.label)
              const initials = logoUrl ? null : getContractorInitials(c.label)
              const y = cYs[i]!
              const selected = hovered?.type === 'contractor' && hovered.name === c.id
              const clickable = !!onSelectContractor
              const logoSize = compactC ? Math.min(14, C_H - 4) : 18
              const logoY = y + (C_H - logoSize) / 2
              const textX = C_X + 10 + logoSize + 8
              const midY = y + C_H * 0.5 + (compactC ? 3.5 : 0)
              const nameY = compactC ? midY : y + C_H * 0.38
              const valueY = compactC ? midY : y + C_H * 0.78
              return (
                <g
                  key={c.id}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  onMouseEnter={() => {
                    if (!isMobile) setHovered({ type: 'contractor', name: c.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    handleOpenableTap(
                      { type: 'contractor', name: c.id },
                      () => { if (clickable) onSelectContractor?.(c.label) },
                    )
                  }}
                >
                  <motion.rect
                    x={C_X} y={y} width={C_W} height={C_H} rx={compactC ? 4 : 8}
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
                  <text
                    x={textX} y={nameY}
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={compactC ? 9 : 11}
                    fontFamily="system-ui, sans-serif"
                  >
                    {c.label}
                  </text>
                  <text
                    x={compactC ? C_X + C_W - 8 : textX}
                    y={valueY}
                    textAnchor={compactC ? 'end' : 'start'}
                    fill={active ? '#c4873a' : '#3f3f46'}
                    fontSize={compactC ? 8 : 10}
                    fontFamily="'SF Mono', ui-monospace, monospace"
                  >
                    {formatCost(c.value)}
                  </text>
                </g>
              )
            })}

            <g
              style={{ cursor: 'default' }}
              onMouseEnter={() => {
                if (!isMobile) setHovered({ type: 'usg' })
              }}
              onMouseLeave={() => {
                if (!isMobile) setHovered(null)
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
                strokeWidth={hovered?.type === 'usg' ? 1.5 : 1}
                animate={{ opacity: 1 }}
              />
              {usFlagUrl && (
                <image
                  href={usFlagUrl}
                  x={U_X + (U_W - 32) / 2} y={U_Y + 16}
                  width={32} height={22}
                  opacity={0.95}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              <text
                x={U_X + U_W / 2} y={U_Y + 56}
                textAnchor="middle"
                fill="#d4d4d8"
                fontSize={11}
                fontFamily="system-ui, sans-serif"
              >
                United States
              </text>
              <text
                x={U_X + U_W / 2} y={U_Y + 74}
                textAnchor="middle"
                fill="#c4873a"
                fontSize={11}
                fontFamily="'SF Mono', ui-monospace, monospace"
              >
                {formatCost(total)}
              </text>
            </g>

            {systems.map((s, i) => {
              const active = nodeOn(activeSystems, s.id)
              const y = sYs[i]!
              const selected = hovered?.type === 'system' && hovered.id === s.id
              const midY = y + S_H * 0.5 + (compactS ? 3 : 0)
              const nameY = compactS ? midY : y + S_H * 0.38
              const valueY = compactS ? midY : y + S_H * 0.78
              return (
                <g
                  key={s.id}
                  style={{ cursor: isMobile ? 'pointer' : 'default' }}
                  onMouseEnter={() => {
                    if (!isMobile) setHovered({ type: 'system', id: s.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    if (isMobile) {
                      if (hoverKey(hovered) === `s:${s.id}`) clearHover()
                      else selectHover({ type: 'system', id: s.id })
                    }
                  }}
                >
                  <motion.rect
                    x={S_X} y={y} width={S_W} height={S_H} rx={compactS ? 4 : 6}
                    fill="#111111"
                    stroke={selected ? '#c4873a' : '#27272a'}
                    strokeWidth={selected ? 1.4 : 1}
                    animate={{ opacity: boxOpacity(active) }}
                    transition={{ duration: 0.15 }}
                  />
                  <text
                    x={S_X + 10} y={nameY}
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={compactS ? 9 : 10}
                    fontFamily="system-ui, sans-serif"
                  >
                    {s.label}
                  </text>
                  <text
                    x={compactS ? S_X + S_W - 8 : S_X + 10}
                    y={valueY}
                    textAnchor={compactS ? 'end' : 'start'}
                    fill={active ? '#c4873a' : '#3f3f46'}
                    fontSize={compactS ? 8 : 9}
                    fontFamily="'SF Mono', ui-monospace, monospace"
                  >
                    {formatCost(s.value)}
                  </text>
                </g>
              )
            })}

            {countries.map((k, i) => {
              const active = nodeOn(activeCountries, k.id)
              const flagUrl = getFlagUrl(k.label, 160)
              const y = kYs[i]!
              const selected = hovered?.type === 'country' && hovered.name === k.id
              const flagH = compactK ? Math.min(10, K_H - 4) : 12
              const flagW = flagH * 1.5
              const flagY = y + (K_H - flagH) / 2
              const midY = y + K_H * 0.5 + (compactK ? 3 : 0)
              const nameY = compactK ? midY : y + K_H * 0.38
              const valueY = compactK ? midY : y + K_H * 0.78
              const textX = K_X + (flagUrl ? 10 + flagW + 6 : 10)
              return (
                <g
                  key={k.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => {
                    if (!isMobile) setHovered({ type: 'country', name: k.id })
                  }}
                  onMouseLeave={() => {
                    if (!isMobile) setHovered(null)
                  }}
                  onClick={e => {
                    e.stopPropagation()
                    if (suppressClickRef.current) {
                      suppressClickRef.current = false
                      return
                    }
                    handleOpenableTap(
                      { type: 'country', name: k.id },
                      () => onSelectCountry(k.label),
                    )
                  }}
                >
                  <motion.rect
                    x={K_X} y={y} width={K_W} height={K_H} rx={compactK ? 4 : 6}
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
                  <text
                    x={textX} y={nameY}
                    fill={active ? '#d4d4d8' : '#52525b'}
                    fontSize={compactK ? 9 : 10}
                    fontFamily="system-ui, sans-serif"
                  >
                    {k.label}
                  </text>
                  <text
                    x={compactK ? K_X + K_W - 8 : textX}
                    y={valueY}
                    textAnchor={compactK ? 'end' : 'start'}
                    fill={active ? '#c4873a' : '#3f3f46'}
                    fontSize={compactK ? 8 : 9}
                    fontFamily="'SF Mono', ui-monospace, monospace"
                  >
                    {formatCost(k.value)}
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
