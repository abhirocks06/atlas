import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleThreshold } from 'd3-scale'
import { COUNTRY_NAME_TO_ISO3, NUMERIC_TO_ISO3, geoDisplayName } from '../utils/countryMapping'
import { formatCost } from '../utils/formatters'
import { prefetchFlag } from '../utils/countryFlags'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json'

const B = 1e9
/**
 * Absolute buckets in the committed teal→amber family:
 * #192030 → #1e4a5c → #2e7d9b → #c4873a
 */
const VALUE_THRESHOLDS = [1 * B, 3 * B, 10 * B, 50 * B] as const
const NO_DATA_COLOR = '#141824'
const VALUE_COLORS = [
  '#192030', // < $1B
  '#1a3a4c', // $1–3B
  '#1e4a5c', // $3–10B
  '#2e7d9b', // $10–50B
  '#c4873a', // ≥ $50B
] as const

const colorForTotal = scaleThreshold<number, string>()
  .domain([...VALUE_THRESHOLDS])
  .range([...VALUE_COLORS])

const LEGEND_ROWS: { color: string; label: string }[] = [
  { color: NO_DATA_COLOR, label: 'No sales data' },
  { color: VALUE_COLORS[0], label: '< $1B' },
  { color: VALUE_COLORS[1], label: '$1B – $3B' },
  { color: VALUE_COLORS[2], label: '$3B – $10B' },
  { color: VALUE_COLORS[3], label: '$10B – $50B' },
  { color: VALUE_COLORS[4], label: '≥ $50B' },
]

// Build reverse map: ISO3 → canonical country name
// Prefer shorter/simpler names when there are aliases
const ISO3_TO_COUNTRY: Record<string, string> = {}
for (const [name, iso3] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
  if (!ISO3_TO_COUNTRY[iso3]) {
    ISO3_TO_COUNTRY[iso3] = name
  }
}

interface Tooltip {
  x: number
  y: number
  country: string
  total: number | null
  count: number | null
}

interface Props {
  countryTotals: Map<string, { total: number; count: number }>
  selectedCountry: string | null
  onSelectCountry: (country: string | null) => void
}

export function WorldMap({ countryTotals, selectedCountry, onSelectCountry }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)

  // Build ISO3 → {total, count} for coloring
  const iso3Data = new Map<string, { total: number; count: number }>()
  for (const [country, data] of countryTotals) {
    const iso3 = COUNTRY_NAME_TO_ISO3[country]
    if (iso3) iso3Data.set(iso3, data)
  }

  return (
    <div className="w-full h-full relative bg-[#0a0c10]">
      <div className="absolute inset-0 translate-y-8 md:translate-y-10">
      <ComposableMap
        projection="geoNaturalEarth1"
        style={{ width: '100%', height: '100%' }}
        projectionConfig={{ scale: 155, center: [10, 10] }}
      >
        <ZoomableGroup zoom={1} minZoom={0.8} maxZoom={8}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // world-atlas stores IDs as zero-padded strings (e.g. "076" for Brazil)
                // Strip leading zeros so "076" → "76" to match our lookup keys
                const rawId = String(geo.id ?? '')
                const numericId = rawId.replace(/^0+/, '') || rawId
                const propName = (geo.properties?.name as string | undefined) ?? null
                // Kosovo (and a few disputed areas) lack a stable numeric id in world-atlas
                const iso3 =
                  NUMERIC_TO_ISO3[numericId] ??
                  (propName ? COUNTRY_NAME_TO_ISO3[propName] : null) ??
                  null
                const countryName = iso3 ? ISO3_TO_COUNTRY[iso3] ?? null : null
                const data = iso3 ? iso3Data.get(iso3) ?? null : null
                const isSelected = countryName !== null && countryName === selectedCountry
                const hasSales = data !== null && data.count > 0
                // Prefer our canonical FMS name; otherwise expand Natural Earth abbreviations
                const label = countryName ?? geoDisplayName(propName)
                const fill = isSelected
                  ? '#f0c14a'
                  : hasSales
                    ? colorForTotal(data!.total)
                    : NO_DATA_COLOR

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => {
                      if (hasSales && countryName) {
                        onSelectCountry(isSelected ? null : countryName)
                      }
                    }}
                    onMouseEnter={(evt) => {
                      if (!label) return
                      if (hasSales) prefetchFlag(label)
                      setTooltip({
                        x: evt.clientX,
                        y: evt.clientY,
                        country: label,
                        total: hasSales && data ? data.total : null,
                        count: hasSales && data ? data.count : null,
                      })
                    }}
                    onMouseMove={(evt) => {
                      if (tooltip) {
                        setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill,
                        stroke: '#0a0c10',
                        strokeWidth: 0.4,
                        outline: 'none',
                        cursor: hasSales ? 'pointer' : 'default',
                      },
                      hover: {
                        fill,
                        filter: hasSales || isSelected ? 'brightness(1.35)' : undefined,
                        stroke: '#0a0c10',
                        strokeWidth: 0.4,
                        outline: 'none',
                        cursor: hasSales ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill,
                        filter: hasSales || isSelected ? 'brightness(1.2)' : undefined,
                        stroke: '#0a0c10',
                        strokeWidth: 0.4,
                        outline: 'none',
                      },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
      </div>

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-lg bg-[#111111] border border-zinc-800/80 px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 160),
            top: Math.max(tooltip.y - 10, 10),
          }}
        >
          <div className="font-semibold text-zinc-200 mb-0.5">{tooltip.country}</div>
          {tooltip.total != null && tooltip.count != null ? (
            <>
              <div className="text-amber-400 font-medium">{formatCost(tooltip.total)}</div>
              <div className="text-zinc-600 mt-0.5">{tooltip.count} notification{tooltip.count !== 1 ? 's' : ''}</div>
            </>
          ) : (
            <div className="text-zinc-600 mt-0.5">No sales data</div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 md:bottom-5 left-3 md:left-5 rounded-xl bg-[#111111]/95 border border-zinc-800/80 px-2.5 md:px-3 py-2 md:py-2.5 text-zinc-500 space-y-1 md:space-y-1.5 backdrop-blur-sm">
        <div className="text-zinc-600 uppercase tracking-widest text-[8px] md:text-[9px] mb-1 md:mb-2">Total Value</div>
        {LEGEND_ROWS.map(row => (
          <div key={row.label} className="flex items-center gap-2">
            <div className="w-3 h-1.5 md:h-2 rounded-sm shrink-0" style={{ background: row.color }} />
            <span className="text-[9px] md:text-xs">{row.label}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-3 md:bottom-5 right-3 md:right-5 text-[9px] md:text-[10px] text-[#252d3d]">
        <span className="hidden md:inline">Scroll to zoom · Drag to pan</span>
        <span className="md:hidden">Pinch to zoom · Drag to pan</span>
      </div>
    </div>
  )
}
