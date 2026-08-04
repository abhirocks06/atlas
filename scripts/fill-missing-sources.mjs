/**
 * Fill missing sourceUrl using Federal Register full-text search,
 * verified against document body (country + cost). Official .gov only.
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_FILE = resolve(ROOT, 'data/fms_notifications.json')

const DRY = process.argv.includes('--dry')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i >= 0 ? Number(process.argv[i + 1]) : Infinity
})()

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Atlas-FMS/1.0 (research; source backfill)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Atlas-FMS/1.0 (research; source backfill)' },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function costPhrases(usd) {
  if (usd == null) return []
  const out = new Set()
  const add = (n, unit) => {
    out.add(`${n} ${unit}`)
    out.add(`$${n} ${unit}`)
    out.add(`$${n} ${unit[0]}`) // $3.8 b — skip, too vague
    if (Number.isInteger(n)) {
      out.add(`${n}.0 ${unit}`)
      out.add(`$${n}.0 ${unit}`)
    }
    // one decimal
    const d1 = (Math.round(n * 10) / 10).toFixed(1)
    out.add(`${d1} ${unit}`)
    out.add(`$${d1} ${unit}`)
    // two / three decimals if meaningful
    if (!Number.isInteger(n)) {
      const d2 = n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
      out.add(`${d2} ${unit}`)
      out.add(`$${d2} ${unit}`)
      const d3 = n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
      out.add(`${d3} ${unit}`)
      out.add(`$${d3} ${unit}`)
    }
  }
  if (usd >= 1e9) {
    add(usd / 1e9, 'billion')
    // also million form for mid values
    if (usd < 10e9) add(usd / 1e6, 'million')
  } else {
    add(usd / 1e6, 'million')
  }
  return [...out].filter(p => !/\$\d+(\.\d+)? [b]$/i.test(p))
}

function systemTokens(system) {
  const stop = new Set([
    'and', 'the', 'of', 'for', 'with', 'to', 'a', 'an', 'systems', 'system',
    'support', 'related', 'equipment', 'services', 'spare', 'parts', 'including',
    'associated', 'aircraft', 'missiles', 'missile', 'helicopters', 'helicopter',
    'program', 'logistics', 'maintenance', 'training', 'technical',
  ])
  const raw = String(system || '')
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s\-./]/g, ' ')
    .split(/[\s/]+/)
    .filter(t => t.length > 2 && !stop.has(t))

  // Prefer distinctive tokens: model numbers, acronyms
  const scored = tokens.map(t => {
    let s = t.length
    if (/[0-9]/.test(t)) s += 10
    if (/^[a-z]{1,4}-?\d/.test(t)) s += 8
    if (t === t.toUpperCase() && t.length <= 6) s += 5
    return { t, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return [...new Set(scored.map(x => x.t))].slice(0, 6)
}

function parseCosts(text) {
  const costs = []
  const re = /\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*(billion|million)\b/gi
  let m
  while ((m = re.exec(text))) {
    const num = parseFloat(m[1].replace(/,/g, ''))
    if (Number.isNaN(num)) continue
    costs.push(m[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6)
  }
  return costs
}

function costClose(a, b) {
  if (a == null || b == null) return false
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1) <= 0.06
}

function countryInText(country, text) {
  const t = text.toLowerCase()
  const c = country.toLowerCase()
  if (t.includes(c)) return true
  const aliases = {
    'republic of korea': ['korea', 'south korea', 'rok'],
    'united kingdom': ['united kingdom', 'u.k.', 'uk '],
    'united arab emirates': ['united arab emirates', 'u.a.e.', 'uae'],
    'bosnia and herzegovina': ['bosnia'],
    taiwan: ['taiwan', 'taipei', 'tecro', 'economic and cultural representative'],
    nato: ['nato'],
  }
  for (const a of aliases[c] || []) {
    if (t.includes(a)) return true
  }
  return false
}

function searchNames(country) {
  const c = country.toLowerCase()
  if (c === 'taiwan') return ['Taiwan', 'Taipei', 'TECRO']
  if (c === 'republic of korea') return ['Korea', 'Republic of Korea', 'South Korea']
  if (c === 'nato') return ['NATO', 'NSPA']
  return [country]
}

function yearOk(notifDate, pubDate) {
  if (!notifDate || !pubDate) return true
  const ny = Number(String(notifDate).slice(0, 4))
  const py = Number(String(pubDate).slice(0, 4))
  if (!ny || !py) return true
  // FR publication often lags notification by months, rarely >3 years
  return py >= ny - 1 && py <= ny + 3
}

function extractTransmittal(text) {
  const m = text.match(/Transmittal\s*(?:No\.?|#)?\s*([0-9]{2}-\s*[0-9A-Z]+)/i)
  return m ? m[1].replace(/\s/g, '') : null
}

function extractGovinfoUrl(htmlUrl, body) {
  // Prefer stable govinfo link if present in FR page
  const m = body.match(/https:\/\/www\.govinfo\.gov\/content\/pkg\/FR-[^"'\\\s]+/i)
  if (m) return m[0].replace(/\.htm.*/, '.htm')
  return htmlUrl
}

const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'))
const missingIdx = []
for (let i = 0; i < data.length; i++) {
  if (!data[i].sourceUrl) missingIdx.push(i)
}
console.log(`Missing: ${missingIdx.length}`)

let filled = 0
let checked = 0

for (const i of missingIdx) {
  if (checked >= LIMIT) break
  checked++
  const n = data[i]
  const tokens = systemTokens(n.system)
  const phrases = costPhrases(n.costUSD)
  if (!phrases.length) {
    console.log(`SKIP ${n.country} ${n.date} (no cost)`)
    continue
  }

  // Try a few query shapes (Taiwan often filed as Taipei/TECRO)
  const queries = []
  const primaryCost = phrases.find(p => p.startsWith('$')) || phrases[0]
  const topTok = tokens.slice(0, 3).join(' ')
  for (const name of searchNames(n.country)) {
    queries.push(`"${name}" ${primaryCost} ${topTok}`)
    queries.push(`"${name}" ${primaryCost}`)
    if (tokens[0]) queries.push(`"${name}" ${tokens[0]} ${tokens[1] || ''} ${primaryCost}`)
  }

  let candidate = null

  for (const q of queries) {
    const url =
      `https://www.federalregister.gov/api/v1/articles.json` +
      `?conditions[term]=${encodeURIComponent(q)}` +
      `&conditions[agencies][]=defense-department` +
      `&fields[]=html_url&fields[]=title&fields[]=publication_date&fields[]=raw_text_url` +
      `&order=newest&per_page=10`
    try {
      const json = await fetchJSON(url)
      for (const a of json.results || []) {
        if (!yearOk(n.date, a.publication_date)) continue
        // Fetch body for verification
        let body = ''
        try {
          if (a.raw_text_url) body = await fetchText(a.raw_text_url)
          else body = await fetchText(a.html_url)
        } catch {
          continue
        }
        if (!countryInText(n.country, body)) continue
        const costs = parseCosts(body)
        if (!costs.some(c => costClose(c, n.costUSD))) continue

        // Require at least one distinctive system token when available
        const lower = body.toLowerCase()
        const tokHits = tokens.filter(t => lower.includes(t)).length
        if (tokens.length >= 2 && tokHits === 0) continue

        candidate = { article: a, body, tokHits }
        break
      }
    } catch (e) {
      console.warn(`ERR query ${n.country}: ${e.message}`)
    }
    if (candidate) break
    await sleep(150)
  }

  if (candidate) {
    const { article, body } = candidate
    n.sourceUrl = extractGovinfoUrl(article.html_url, body) || article.html_url
    const tx = extractTransmittal(body)
    if (!n.transmittal && tx) n.transmittal = tx
    filled++
    console.log(
      `OK  ${n.country.padEnd(22)} ${n.date}  $${n.costUSD}  → ${n.sourceUrl}` +
        (tx ? `  [${tx}]` : ''),
    )
  } else {
    console.log(`MISS ${n.country.padEnd(22)} ${n.date}  $${n.costUSD}  ${(n.system || '').slice(0, 40)}`)
  }

  await sleep(200)

  // checkpoint every 15
  if (!DRY && filled > 0 && filled % 15 === 0) {
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n')
    console.log(`  (checkpoint saved, filled ${filled})`)
  }
}

console.log(`\nFilled ${filled}/${checked}. Remaining missing: ${data.filter(n => !n.sourceUrl).length}`)
if (!DRY) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n')
  console.log('Saved.')
}
