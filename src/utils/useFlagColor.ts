import { useState, useEffect } from 'react'
import { getFlagUrl } from './countryFlags'

// Sample pixels from the flag image and pick the most "vivid" non-neutral color
function extractDominantColor(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = 40
  canvas.height = 24
  const ctx = canvas.getContext('2d')
  if (!ctx) return '#92400e'
  ctx.drawImage(img, 0, 0, 40, 24)

  const data = ctx.getImageData(0, 0, 40, 24).data
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
    if (a < 200) continue // skip transparent

    // Quantize to reduce noise
    const qr = Math.round(r / 32) * 32
    const qg = Math.round(g / 32) * 32
    const qb = Math.round(b / 32) * 32
    const key = `${qr},${qg},${qb}`
    const prev = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    buckets.set(key, { count: prev.count + 1, r: qr, g: qg, b: qb })
  }

  // Score each bucket: prefer vivid (high saturation) over neutral (white/grey/black)
  let best = { score: -1, r: 180, g: 100, b: 40 }
  for (const { count, r, g, b } of buckets.values()) {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const lightness = (max + min) / 2
    const saturation = max === min ? 0 : (max - min) / (lightness < 128 ? max + min : 510 - max - min)

    // Skip very dark, very white, or very grey pixels
    if (lightness < 30 || lightness > 230 || saturation < 0.2) continue

    const score = count * saturation * (1 - Math.abs(lightness - 128) / 128)
    if (score > best.score) {
      best = { score, r, g, b }
    }
  }

  return `rgb(${best.r}, ${best.g}, ${best.b})`
}

export function useFlagColor(country: string): string {
  const [color, setColor] = useState<string>('#92400e') // amber default
  const flagUrl = getFlagUrl(country)

  useEffect(() => {
    if (!flagUrl) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const c = extractDominantColor(img)
        setColor(c)
      } catch {
        // CORS or canvas error — keep default
      }
    }
    img.src = flagUrl
  }, [flagUrl])

  return color
}
