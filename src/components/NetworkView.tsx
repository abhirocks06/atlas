import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Notification } from '../types'
import { normalizeContractor } from '../utils/normalizeContractor'
import { formatCost } from '../utils/formatters'
import { getFlagUrl } from '../utils/countryFlags'

interface Props {
  filtered: Notification[]
  onSelectCountry: (country: string) => void
}

const VB_W = 1400
const VB_H = 760
const CX = 310   // contractor column x
const KX = 1090  // country column x
const PAD_Y = 50

const MAX_CONTRACTORS = 14
const MAX_COUNTRIES = 22

export function NetworkView({ filtered, onSelectCountry }: Props) {
  const [hovered, setHovered] = useState<{ type: 'contractor' | 'country'; name: string } | null>(null)

  const { contractors, countries, edges } = useMemo(() => {
    const cMap = new Map<string, number>()  // contractor → total
    const kMap = new Map<string, number>()  // country → total
    const eMap = new Map<string, number>()  // "c::k" → total

    for (const n of filtered) {
      if (!n.country || !n.costUSD) continue
      const c = n.contractor
        ? normalizeContractor(n.contractor.split(' / ')[0].trim())
        : null
      const k = n.country
      const v = n.costUSD

      kMap.set(k, (kMap.get(k) ?? 0) + v)

      if (c) {
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

  const maxEdgeValue = Math.max(...edges.map(e => e.value), 1)

  const cY = (i: number) =>
    PAD_Y + (i / Math.max(contractors.length - 1, 1)) * (VB_H - 2 * PAD_Y)
  const kY = (i: number) =>
    PAD_Y + (i / Math.max(countries.length - 1, 1)) * (VB_H - 2 * PAD_Y)

  const cIndex = new Map(contractors.map((c, i) => [c.name, i]))
  const kIndex = new Map(countries.map((c, i) => [c.name, i]))

  const isEdgeActive = (e: { contractor: string; country: string }) => {
    if (!hovered) return true
    if (hovered.type === 'contractor') return e.contractor === hovered.name
    return e.country === hovered.name
  }

  const isNodeActive = (type: 'contractor' | 'country', name: string) => {
    if (!hovered) return true
    if (hovered.type === type) return hovered.name === name
    if (hovered.type === 'contractor') {
      return edges.some(e => e.contractor === hovered.name && e.country === name)
    }
    return edges.some(e => e.country === hovered.name && e.contractor === name)
  }

  return (
    <div className="w-full h-full bg-[#0b0e16] relative overflow-hidden">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
      >
        {/* Edges */}
        {edges.map(e => {
          const ci = cIndex.get(e.contractor)
          const ki = kIndex.get(e.country)
          if (ci === undefined || ki === undefined) return null

          const x1 = CX, y1 = cY(ci)
          const x2 = KX, y2 = kY(ki)
          const mx = (x1 + x2) / 2

          const active = isEdgeActive(e)
          const logW = (Math.log(e.value + 1) / Math.log(maxEdgeValue + 1))
          const strokeW = 0.5 + logW * 3.5

          return (
            <motion.path
              key={`${e.contractor}::${e.country}`}
              d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
              fill="none"
              stroke={active && hovered ? '#e09a45' : '#c4873a'}
              strokeWidth={strokeW}
              initial={{ opacity: 0 }}
              animate={{ opacity: active ? (hovered ? 0.75 : 0.18) : 0.03 }}
              transition={{ duration: 0.15 }}
            />
          )
        })}

        {/* Contractor nodes */}
        {contractors.map((c, i) => {
          const x = CX, y = cY(i)
          const active = isNodeActive('contractor', c.name)

          return (
            <g
              key={c.name}
              style={{ cursor: 'default' }}
              onMouseEnter={() => setHovered({ type: 'contractor', name: c.name })}
              onMouseLeave={() => setHovered(null)}
            >
              <motion.circle
                cx={x} cy={y} r={4}
                fill="#c4873a"
                animate={{ opacity: active ? 1 : 0.2 }}
                transition={{ duration: 0.15 }}
              />
              <motion.text
                x={x - 12}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={11}
                fontFamily="'SF Mono', 'Fira Code', monospace"
                animate={{ fill: active ? '#c9c3b8' : '#3a3f4a', opacity: active ? 1 : 0.4 }}
                transition={{ duration: 0.15 }}
              >
                {c.name}
              </motion.text>
              <motion.text
                x={x - 12} y={y + 13}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={8.5}
                fontFamily="'SF Mono', 'Fira Code', monospace"
                animate={{ fill: active ? '#c4873a' : '#2a2f38', opacity: active ? 1 : 0.3 }}
                transition={{ duration: 0.15 }}
              >
                {formatCost(c.value)}
              </motion.text>
            </g>
          )
        })}

        {/* Country nodes */}
        {countries.map((k, i) => {
          const x = KX, y = kY(i)
          const active = isNodeActive('country', k.name)
          const flagUrl = getFlagUrl(k.name)

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
              {/* Flag */}
              {flagUrl && (
                <motion.image
                  href={flagUrl}
                  x={x + 12} y={y - 9}
                  width={20} height={14}
                  style={{ opacity: active ? 0.85 : 0.15 }}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              <motion.text
                x={flagUrl ? x + 38 : x + 12}
                y={y}
                textAnchor="start"
                dominantBaseline="middle"
                fontSize={11}
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
                fontSize={8.5}
                fontFamily="'SF Mono', 'Fira Code', monospace"
                animate={{ fill: active ? '#c4873a' : '#2a2f38', opacity: active ? 1 : 0.3 }}
                transition={{ duration: 0.15 }}
              >
                {formatCost(k.value)}
              </motion.text>
            </g>
          )
        })}

        {/* Column labels */}
        <text x={CX} y={18} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#3a3f4a" letterSpacing="2">
          CONTRACTORS
        </text>
        <text x={KX} y={18} textAnchor="middle" fontSize={9} fontFamily="monospace" fill="#3a3f4a" letterSpacing="2">
          COUNTRIES
        </text>
      </svg>

      {/* Click hint */}
      <div className="absolute bottom-4 right-5 text-[10px] text-zinc-700">
        Click a country to drill in
      </div>
    </div>
  )
}
