import { useState } from 'react'
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import { COUNTRY_NAME_TO_ISO3, NUMERIC_TO_ISO3 } from '../utils/countryMapping'
import { formatCost } from '../utils/formatters'
import { prefetchFlag } from '../utils/countryFlags'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

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
  total: number
  count: number
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

  const maxTotal = iso3Data.size > 0
    ? Math.max(...[...iso3Data.values()].map(v => v.total))
    : 1

  const colorScale = scaleLinear<string>()
    .domain([0, maxTotal * 0.05, maxTotal * 0.3, maxTotal])
    .range(['#192030', '#1e4a5c', '#2e7d9b', '#c4873a'])
    .clamp(true)

  return (
    <div className="w-full h-full relative bg-[#0b0e16]">
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
                const iso3 = NUMERIC_TO_ISO3[numericId] ?? null
                const countryName = iso3 ? ISO3_TO_COUNTRY[iso3] ?? null : null
                const data = iso3 ? iso3Data.get(iso3) ?? null : null
                const isSelected = countryName !== null && countryName === selectedCountry
                const hasSales = data !== null && data.count > 0

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
                      if (hasSales && countryName && data) {
                        prefetchFlag(countryName)
                        setTooltip({
                          x: evt.clientX,
                          y: evt.clientY,
                          country: countryName,
                          total: data.total,
                          count: data.count,
                        })
                      }
                    }}
                    onMouseMove={(evt) => {
                      if (tooltip) {
                        setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)
                      }
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill: isSelected
                          ? '#e09a45'
                          : hasSales
                          ? colorScale(data!.total)
                          : '#141824',
                        stroke: '#0b0e16',
                        strokeWidth: 0.4,
                        outline: 'none',
                        cursor: hasSales ? 'pointer' : 'default',
                      },
                      hover: {
                        fill: isSelected
                          ? '#e8a84e'
                          : hasSales
                          ? colorScale(data!.total)
                          : '#1a1f2e',
                        filter: hasSales || isSelected ? 'brightness(1.35)' : undefined,
                        stroke: '#0b0e16',
                        strokeWidth: 0.4,
                        outline: 'none',
                        cursor: hasSales ? 'pointer' : 'default',
                      },
                      pressed: {
                        fill: isSelected
                          ? '#f0b45a'
                          : hasSales
                          ? colorScale(data!.total)
                          : '#1a1f2e',
                        filter: hasSales || isSelected ? 'brightness(1.2)' : undefined,
                        stroke: '#0b0e16',
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

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 bg-[#1a1f2e] border border-[#2a3040] px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 14, window.innerWidth - 160),
            top: Math.max(tooltip.y - 10, 10),
          }}
        >
          <div className="font-semibold text-[#c9c3b8] mb-0.5">{tooltip.country}</div>
          <div className="text-[#c4873a] font-medium">{formatCost(tooltip.total)}</div>
          <div className="text-[#4a5568] mt-0.5">{tooltip.count} notification{tooltip.count !== 1 ? 's' : ''}</div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 md:bottom-5 left-3 md:left-5 bg-[#0b0e16]/90 border border-[#1e2535] px-2 md:px-3 py-1.5 md:py-2 text-[#4a5568] space-y-1 md:space-y-1.5">
        <div className="text-[#5a6a7d] uppercase tracking-widest text-[8px] md:text-[9px] mb-1 md:mb-2">Total FMS Value</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-1.5 md:h-2" style={{ background: '#141824' }} />
          <span className="text-[9px] md:text-xs">No sales data</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-1.5 md:h-2" style={{ background: '#1e4a5c' }} />
          <span className="text-[9px] md:text-xs">&lt; $1B</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-1.5 md:h-2" style={{ background: '#2e7d9b' }} />
          <span className="text-[9px] md:text-xs">$1B – $10B</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-1.5 md:h-2" style={{ background: '#c4873a' }} />
          <span className="text-[9px] md:text-xs">&gt; $10B</span>
        </div>
      </div>

      <div className="absolute bottom-3 md:bottom-5 right-3 md:right-5 text-[9px] md:text-[10px] text-[#252d3d]">
        <span className="hidden md:inline">Scroll to zoom · Drag to pan</span>
        <span className="md:hidden">Pinch to zoom · Drag to pan</span>
      </div>
    </div>
  )
}
