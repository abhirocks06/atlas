import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { contractorNames } from '../utils/parseContractors'
import { formatCost } from '../utils/formatters'
import { getFlagUrl } from '../utils/countryFlags'
import { getContractorLogoUrl } from '../utils/contractorLogos'

interface Props {
  filtered: Notification[]
  onSelectCountry: (country: string) => void
  onSelectContractor?: (contractor: string) => void
}

const VB_W = 1400
const VB_H = 760
const CX = 200   // contractor column x
const UX = 700   // USG hub x
const KX = 1200  // country column x
const UY = VB_H / 2
const PAD_Y = 56
/** Modest margin so edge labels aren’t clipped */
const VB_PAD_X = 48
const VB_PAD_Y = 28
const DEFAULT_ZOOM = 0.95
/** Shift framing down so the graph starts below the floating top bar */
const HEADER_CLEARANCE = 72

/** Static framing baseline (desktop remains locked) */
const BASE_FRAME_TRANSFORM = `translate(${VB_W / 2}, ${VB_H / 2}) scale(${DEFAULT_ZOOM}) translate(${-VB_W / 2}, ${-VB_H / 2 + HEADER_CLEARANCE})`

const MAX_CONTRACTORS = 14
const MAX_COUNTRIES = 22
const US_LABEL = 'United States of America'

export function NetworkView({ filtered, onSelectCountry, onSelectContractor }: Props) {
  const [hovered, setHovered] = useState<{ type: 'contractor' | 'usg' | 'country'; name: string } | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [zoom, setZoom] = useState(1)
  const pinchStartDistRef = useRef<number | null>(null)
  const pinchStartZoomRef = useRef(1)

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 640px)')
    const update = () => setIsMobile(mql.matches)
    update()
    if ('addEventListener' in mql) {
      mql.addEventListener('change', update)
    } else {
      // Legacy Safari / older DOM APIs
      ;(mql as any).addListener?.(update)
    }
    return () => {
      if ('removeEventListener' in mql) {
        mql.removeEventListener('change', update)
      } else {
        ;(mql as any).removeListener?.(update)
      }
    }
  }, [])

  const frameTransform = useMemo(() => {
    if (!isMobile) return BASE_FRAME_TRANSFORM
    const z = Math.max(0.75, Math.min(1.55, zoom))
    return `translate(${VB_W / 2}, ${VB_H / 2}) scale(${DEFAULT_ZOOM * z}) translate(${-VB_W / 2}, ${-VB_H / 2 + HEADER_CLEARANCE})`
  }, [isMobile, zoom])

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return
    if (e.touches.length !== 2) return
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    pinchStartDistRef.current = Math.hypot(dx, dy)
    pinchStartZoomRef.current = zoom
  }

  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return
    if (e.touches.length !== 2) return
    e.preventDefault()
    const t1 = e.touches[0]
    const t2 = e.touches[1]
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    const dist = Math.hypot(dx, dy)
    const startDist = pinchStartDistRef.current
    if (!startDist || startDist <= 0) return
    const ratio = dist / startDist
    const next = pinchStartZoomRef.current * ratio
    setZoom(Math.max(0.75, Math.min(1.55, next)))
  }

  const resetZoom = () => setZoom(1)
  const { contractors, countries, edges } = useMemo(() => {
    const cMap = new Map<string, number>()
    const kMap = new Map<string, number>()
    const eMap = new Map<string, number>()

    for (const n of filtered) {
      if (!n.country || !n.costUSD) continue
      const names = contractorNames(n.contractor, n.contractorLocation)
      const k = n.country
      const v = n.costUSD

      kMap.set(k, (kMap.get(k) ?? 0) + v)

      for (const c of names) {
        cMap.set(c, (cMap.get(c) ?? 0) + v)
        const key = `${c}::${k}`
        eMap.set(key, (eMap.get(key) ?? 0) + v)
      }
    }

    const contractors = [...cMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_CONTRACTORS)
      .map(([name, value]) => ({ name, value }))

    const cSet = new Set(contractors.map(c => c.name))

    const edges: { contractor: string; country: string; value: number }[] = []
    for (const [key, value] of eMap) {
      const [c, k] = key.split('::')
      if (cSet.has(c)) edges.push({ contractor: c, country: k, value })
    }

    const connectedCountries = new Set(edges.map(e => e.country))
    const countries = [...kMap.entries()]
      .filter(([k]) => connectedCountries.has(k))
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_COUNTRIES)
      .map(([name, value]) => ({ name, value }))

    const kSet = new Set(countries.map(c => c.name))
    const filteredEdges = edges.filter(e => kSet.has(e.country))

    return { contractors, countries, edges: filteredEdges }
  }, [filtered])

  const fontSize = 11
  const subFontSize = 8.5

  const maxEdgeValue = Math.max(...edges.map(e => e.value), 1)

  const cY = (i: number) =>
    PAD_Y + (i / Math.max(contractors.length - 1, 1)) * (VB_H - 2 * PAD_Y)
  const kY = (i: number) =>
    PAD_Y + (i / Math.max(countries.length - 1, 1)) * (VB_H - 2 * PAD_Y)

  const cIndex = new Map(contractors.map((c, i) => [c.name, i]))
  const kIndex = new Map(countries.map((c, i) => [c.name, i]))

  const isEdgeActive = (e: { contractor: string; country: string }) => {
    if (!hovered) return true
    if (hovered.type === 'usg') return true
    if (hovered.type === 'contractor') return e.contractor === hovered.name
    return e.country === hovered.name
  }

  const isNodeActive = (type: 'contractor' | 'country', name: string) => {
    if (!hovered) return true
    if (hovered.type === 'usg') return true
    if (hovered.type === type) return hovered.name === name
    if (hovered.type === 'contractor') {
      return edges.some(e => e.contractor === hovered.name && e.country === name)
    }
    return edges.some(e => e.country === hovered.name && e.contractor === name)
  }

  const isContractorActive = (name: string) => {
    if (!hovered) return true
    if (hovered.type === 'usg') return true
    if (hovered.type === 'contractor') return hovered.name === name
    return edges.some(e => e.country === hovered.name && e.contractor === name)
  }

  const isUsgActive = () => {
    if (!hovered) return true
    return hovered.type === 'usg'
  }

  const usFlagUrl = getFlagUrl(US_LABEL, 160)

  return (
    <div
      className="w-full h-full bg-[#0a0c10] relative overflow-hidden"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      style={{ touchAction: isMobile ? 'none' : undefined }}
    >
      <svg
        viewBox={`${-VB_PAD_X} ${-VB_PAD_Y} ${VB_W + VB_PAD_X * 2} ${VB_H + VB_PAD_Y * 2}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        <g transform={frameTransform}>
          {edges.map(e => {
            const ci = cIndex.get(e.contractor)
            const ki = kIndex.get(e.country)
            if (ci === undefined || ki === undefined) return null

            const x1 = CX, y1 = cY(ci)
            const x2 = KX, y2 = kY(ki)
            const mx1 = (x1 + UX) / 2
            const mx2 = (UX + x2) / 2

            const active = isEdgeActive(e)
            const logW = Math.log(e.value + 1) / Math.log(maxEdgeValue + 1)
            const strokeW = 0.5 + logW * 3.5
            const key = `${e.contractor}::${e.country}`

            return (
              <g key={key}>
                <motion.path
                  d={`M${x1},${y1} C${mx1},${y1} ${mx1},${UY} ${UX},${UY}`}
                  fill="none"
                  stroke={active && hovered ? '#e09a45' : '#c4873a'}
                  strokeWidth={strokeW}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: active ? (hovered ? 0.75 : 0.18) : 0.03 }}
                  transition={{ duration: 0.15 }}
                />
                <motion.path
                  d={`M${UX},${UY} C${mx2},${UY} ${mx2},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={active && hovered ? '#e09a45' : '#c4873a'}
                  strokeWidth={strokeW}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: active ? (hovered ? 0.75 : 0.18) : 0.03 }}
                  transition={{ duration: 0.15 }}
                />
              </g>
            )
          })}

          {contractors.map((c, i) => {
            const x = CX, y = cY(i)
            const active = isContractorActive(c.name)
            const logoUrl = getContractorLogoUrl(c.name)

            return (
              <g
                key={c.name}
                style={{ cursor: onSelectContractor ? 'pointer' : 'default' }}
                onMouseEnter={() => setHovered({ type: 'contractor', name: c.name })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectContractor?.(c.name)}
              >
                <motion.circle
                  cx={x} cy={y} r={4}
                  fill="#c4873a"
                  animate={{ opacity: active ? 1 : 0.2 }}
                  transition={{ duration: 0.15 }}
                />
                {logoUrl && (
                  <image
                    href={logoUrl}
                    x={x - 34}
                    y={y - 9}
                    width={18}
                    height={18}
                    opacity={active ? 0.95 : 0.15}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
                <motion.text
                  x={logoUrl ? x - 40 : x - 12}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontFamily="'SF Mono', 'Fira Code', monospace"
                  animate={{ fill: active ? '#c9c3b8' : '#3a3f4a', opacity: active ? 1 : 0.4 }}
                  transition={{ duration: 0.15 }}
                >
                  {c.name}
                </motion.text>
                <motion.text
                  x={logoUrl ? x - 40 : x - 12}
                  y={y + 13}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={subFontSize}
                  fontFamily="'SF Mono', 'Fira Code', monospace"
                  animate={{ fill: active ? '#c4873a' : '#2a2f38', opacity: active ? 1 : 0.3 }}
                  transition={{ duration: 0.15 }}
                >
                  {formatCost(c.value)}
                </motion.text>
              </g>
            )
          })}

          <g
            style={{ cursor: 'default' }}
            onMouseEnter={() => setHovered({ type: 'usg', name: US_LABEL })}
            onMouseLeave={() => setHovered(null)}
          >
            <motion.circle
              cx={UX} cy={UY} r={4}
              fill="#c4873a"
              animate={{ opacity: isUsgActive() ? 1 : 0.2 }}
              transition={{ duration: 0.15 }}
            />
            {usFlagUrl && (
              <image
                href={usFlagUrl}
                x={UX - 16}
                y={UY + 12}
                width={32}
                height={22}
                opacity={isUsgActive() ? 0.95 : 0.2}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            <motion.text
              x={UX}
              y={UY + 48}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontFamily="'SF Mono', 'Fira Code', monospace"
              animate={{ fill: isUsgActive() ? '#c9c3b8' : '#3a3f4a', opacity: isUsgActive() ? 1 : 0.4 }}
              transition={{ duration: 0.15 }}
            >
              United States
            </motion.text>
            <motion.text
              x={UX}
              y={UY + 61}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10}
              fontFamily="'SF Mono', 'Fira Code', monospace"
              animate={{ fill: isUsgActive() ? '#c9c3b8' : '#3a3f4a', opacity: isUsgActive() ? 1 : 0.4 }}
              transition={{ duration: 0.15 }}
            >
              of America
            </motion.text>
          </g>

          {countries.map((k, i) => {
            const x = KX, y = kY(i)
            const active = isNodeActive('country', k.name)
            const flagUrl = getFlagUrl(k.name, 160)

            return (
              <g
                key={k.name}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered({ type: 'country', name: k.name })}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectCountry(k.name)}
              >
                <motion.circle
                  cx={x} cy={y} r={4}
                  fill="#c4873a"
                  animate={{ opacity: active ? 1 : 0.2 }}
                  transition={{ duration: 0.15 }}
                />
                {flagUrl && (
                  <image
                    href={flagUrl}
                    x={x + 12} y={y - 9}
                    width={20} height={14}
                    opacity={active ? 0.95 : 0.15}
                    preserveAspectRatio="xMidYMid meet"
                  />
                )}
                <motion.text
                  x={flagUrl ? x + 38 : x + 12}
                  y={y}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={fontSize}
                  fontFamily="'SF Mono', 'Fira Code', monospace"
                  animate={{ fill: active ? '#c9c3b8' : '#3a3f4a', opacity: active ? 1 : 0.4 }}
                  transition={{ duration: 0.15 }}
                >
                  {k.name}
                </motion.text>
                <motion.text
                  x={flagUrl ? x + 38 : x + 12}
                  y={y + 13}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fontSize={subFontSize}
                  fontFamily="'SF Mono', 'Fira Code', monospace"
                  animate={{ fill: active ? '#c4873a' : '#2a2f38', opacity: active ? 1 : 0.3 }}
                  transition={{ duration: 0.15 }}
                >
                  {formatCost(k.value)}
                </motion.text>
              </g>
            )
          })}

          <text x={CX - 12} y={18} textAnchor="end" fontSize={9} fontFamily="monospace" fill="#3a3f4a" letterSpacing="2">
            CONTRACTORS
          </text>
          <text x={KX + 12} y={18} textAnchor="start" fontSize={9} fontFamily="monospace" fill="#3a3f4a" letterSpacing="2">
            COUNTRIES
          </text>
        </g>
      </svg>

      <div className="absolute bottom-3 md:bottom-5 right-3 md:right-5 text-[9px] md:text-[10px] text-[#252d3d] pointer-events-none">
        {isMobile ? 'Pinch to zoom · Tap to drill in' : 'Hover to highlight · Click a country or contractor to drill in'}
      </div>

      {isMobile && (
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom(z => Math.max(0.75, z - 0.15))}
            className="pointer-events-auto w-9 h-9 rounded-lg bg-black/30 border border-zinc-800/80 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setZoom(z => Math.min(1.55, z + 0.15))}
            className="pointer-events-auto w-9 h-9 rounded-lg bg-black/30 border border-zinc-800/80 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={resetZoom}
            className="pointer-events-auto w-9 h-9 rounded-lg bg-black/30 border border-zinc-800/80 text-zinc-300 hover:text-white hover:border-zinc-700 transition-colors text-[12px]"
            aria-label="Reset zoom"
          >
            ↺
          </button>
        </div>
      )}
    </div>
  )
}
