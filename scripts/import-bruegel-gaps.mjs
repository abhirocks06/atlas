/**
 * Import Bruegel-only FMS notifications into Atlas.
 * Skips rows that already match Atlas (country + date + $) and
 * value-mismatch twins (same country/month + similar system, different $).
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const atlasPath = resolve(root, 'data/fms_notifications.json')
const bruegelPath = resolve(root, 'tmp_bruegel_compare/bruegel_maindata.json')

const COUNTRY_MAP = {
  'south korea': 'Republic of Korea',
  'uae': 'United Arab Emirates',
  'united arab emirates': 'United Arab Emirates',
  'nato': 'NATO',
  'nato support and procurement agency': 'NATO',
  'nato support and procurement agency (nato)': 'NATO',
  'nato support and procurement agency (nspa)': 'NATO',
  'nato communications and information agency (ncia)': 'NATO',
  'bosnia-herzegovina': 'Bosnia and Herzegovina',
  'bosnia and herzegovina': 'Bosnia and Herzegovina',
  'czech republic': 'Czech Republic',
  'the netherlands': 'Netherlands',
  'uk': 'United Kingdom',
  'united kingdom': 'United Kingdom',
}

function normCountryKey(s) {
  if (!s) return ''
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s'()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function atlasCountry(s) {
  const key = normCountryKey(s)
  if (COUNTRY_MAP[key]) return COUNTRY_MAP[key]
  // Title-ish: keep Bruegel casing for new countries (Kenya, Kazakhstan, …)
  return s.trim()
}

function normText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenOverlap(a, b) {
  const stop = new Set([
    'and', 'the', 'of', 'for', 'with', 'to', 'a', 'an', 'systems', 'system',
    'support', 'related', 'equipment', 'services', 'spare', 'parts', 'including',
    'associated', 'aircraft', 'missiles', 'missile',
  ])
  const ta = new Set(normText(a).split(' ').filter(t => t.length > 3 && !stop.has(t)))
  const tb = new Set(normText(b).split(' ').filter(t => t.length > 3 && !stop.has(t)))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.min(ta.size, tb.size)
}

function relDiff(aUsd, bBillion) {
  if (aUsd == null || bBillion == null) return 999
  const aB = aUsd / 1e9
  const denom = Math.max(Math.abs(aB), Math.abs(bBillion), 1e-9)
  return Math.abs(aB - bBillion) / denom
}

function ym(date) {
  if (!date || date.length < 7) return [null, null]
  return [Number(date.slice(0, 4)), Number(date.slice(5, 7))]
}

/** Parse Bruegel "i) Name: City, ST" contractor blobs into Atlas " / " lists. */
function parseContractors(raw) {
  if (!raw || typeof raw !== 'string') return { contractor: null, contractorLocation: null }
  const text = raw.replace(/\r/g, '').trim()
  if (!text) return { contractor: null, contractorLocation: null }

  const items = []
  // Enumerated lines: i) Name: Loc
  const re =
    /(?:^|\n)\s*(?:[ivxlc]+|\d+)\)\s*([^\n]+?)(?=(?:\n\s*(?:[ivxlc]+|\d+)\))|$)/gi
  let m
  while ((m = re.exec(text))) {
    const chunk = m[1].replace(/\s+/g, ' ').trim()
    if (!chunk) continue
    const colon = chunk.indexOf(':')
    if (colon > 0) {
      items.push({
        name: chunk.slice(0, colon).trim(),
        loc: chunk.slice(colon + 1).trim(),
      })
    } else {
      items.push({ name: chunk, loc: null })
    }
  }

  if (!items.length) {
    // Non-enumerated: "Name: Loc" or bare name
    const colon = text.indexOf(':')
    if (colon > 0 && colon < 80) {
      items.push({
        name: text.slice(0, colon).replace(/\s+/g, ' ').trim(),
        loc: text.slice(colon + 1).replace(/\s+/g, ' ').trim(),
      })
    } else {
      const name = text.replace(/\s+/g, ' ').trim()
      if (name && name.length < 160) items.push({ name, loc: null })
    }
  }

  if (!items.length) return { contractor: null, contractorLocation: null }

  const names = items.map(i => i.name).filter(Boolean)
  const locs = items.map(i => i.loc).filter(Boolean)
  return {
    contractor: names.length ? names.join(' / ') : null,
    contractorLocation: locs.length ? locs.join(' / ') : null,
  }
}

function costFromBillion(b) {
  if (b == null || Number.isNaN(Number(b))) return null
  return Math.round(Number(b) * 1e9)
}

function cleanDescription(additional, quantities) {
  const parts = []
  if (additional && String(additional).trim()) {
    parts.push(String(additional).replace(/\s+/g, ' ').trim())
  }
  if (quantities && String(quantities).trim()) {
    const q = String(quantities).replace(/\s+/g, ' ').trim()
    // Prefer quantities when additional is huge boilerplate-only
    if (!parts.length || q.length < 2000) parts.push(`Quantities: ${q}`)
  }
  if (!parts.length) return null
  const joined = parts.join('\n\n')
  // Cap extreme length
  return joined.length > 4000 ? joined.slice(0, 3997) + '…' : joined
}

const atlas = JSON.parse(readFileSync(atlasPath, 'utf8'))
const bruegel = JSON.parse(readFileSync(bruegelPath, 'utf8'))

// Index Atlas by normalized country
const byCountry = new Map()
for (let i = 0; i < atlas.length; i++) {
  const key = normCountryKey(atlasCountry(atlas[i].country))
  if (!byCountry.has(key)) byCountry.set(key, [])
  byCountry.get(key).push(i)
}

const matchedBruegel = new Set()
const twinSkip = [] // value-mismatch twins to skip
const toImport = []

for (const b of bruegel) {
  const country = atlasCountry(b.country)
  const ckey = normCountryKey(country)
  const candidates = byCountry.get(ckey) || []

  let moneyMatch = null
  let twin = null

  for (const ai of candidates) {
    const n = atlas[ai]
    const [ay, am] = ym(n.date)
    if (ay && b.year && Math.abs(ay - b.year) > 1) continue

    const rd = relDiff(n.costUSD, b.financial_value)
    const absd = Math.abs((n.costUSD || 0) / 1e9 - (b.financial_value || 0))
    const moneyOk = rd <= 0.05 || absd <= 0.008
    const overlap = tokenOverlap(b.main_equipment, n.system)
    const sameYm =
      ay === b.year && am === b.month
        ? true
        : ay === b.year && am != null && b.month != null && Math.abs(am - b.month) <= 1

    if (moneyOk && (overlap >= 0.22 || rd <= 0.02 || absd <= 0.003)) {
      // Prefer exact-ish month when multiple money matches
      if (!moneyMatch || (sameYm && !moneyMatch.sameYm) || rd < moneyMatch.rd) {
        moneyMatch = { ai, rd, overlap, sameYm }
      }
    }

    // Twin: same window + strong name overlap, money disagrees
    if (sameYm && overlap >= 0.4 && !moneyOk) {
      if (!twin || overlap > twin.overlap) twin = { ai, overlap, rd }
    }
  }

  if (moneyMatch) {
    matchedBruegel.add(b.id)
    continue
  }

  if (twin) {
    twinSkip.push({
      bruegelId: b.id,
      country,
      ym: `${b.year}-${String(b.month).padStart(2, '0')}`,
      valueB: b.financial_value,
      equipment: b.main_equipment,
      atlasDate: atlas[twin.ai].date,
      atlasUsd: atlas[twin.ai].costUSD,
      atlasSystem: atlas[twin.ai].system,
      overlap: twin.overlap,
    })
    continue
  }

  const { contractor, contractorLocation } = parseContractors(b.contractors)
  const month = b.month || 1
  const date = `${b.year}-${String(month).padStart(2, '0')}-01`

  toImport.push({
    date,
    transmittal: null,
    country,
    system: (b.main_equipment || '').replace(/\s+/g, ' ').trim() || null,
    costUSD: costFromBillion(b.financial_value),
    contractor,
    contractorLocation,
    description: cleanDescription(b.additional_equipment, b.quantities),
    sourceUrl: null,
    // No addedAt — historical Bruegel backfill should not appear as "new"
    _bruegelId: b.id,
  })
}

// Sort import by date then country
toImport.sort((a, b) => a.date.localeCompare(b.date) || (a.country || '').localeCompare(b.country || ''))

const before = atlas.length
const merged = [...atlas, ...toImport.map(({ _bruegelId, ...n }) => n)]
merged.sort((a, b) => {
  const d = (a.date || '').localeCompare(b.date || '')
  if (d) return d
  return (a.country || '').localeCompare(b.country || '') || (a.system || '').localeCompare(b.system || '')
})

writeFileSync(atlasPath, JSON.stringify(merged, null, 2) + '\n')

const report = {
  before,
  after: merged.length,
  imported: toImport.length,
  importedUsdB: toImport.reduce((s, n) => s + (n.costUSD || 0), 0) / 1e9,
  matchedExisting: matchedBruegel.size,
  twinSkipped: twinSkip.length,
  twins: twinSkip,
  newCountries: [...new Set(toImport.map(n => n.country))].filter(
    c => !atlas.some(n => n.country === c),
  ),
  byYear: toImport.reduce((acc, n) => {
    const y = n.date.slice(0, 4)
    acc[y] = (acc[y] || 0) + 1
    return acc
  }, {}),
  sample: toImport.slice(0, 15).map(n => ({
    date: n.date,
    country: n.country,
    costB: (n.costUSD || 0) / 1e9,
    system: (n.system || '').slice(0, 70),
    contractor: n.contractor,
  })),
}

writeFileSync(
  resolve(root, 'tmp_bruegel_compare/import_report.json'),
  JSON.stringify(report, null, 2),
)

console.log(JSON.stringify({
  before: report.before,
  after: report.after,
  imported: report.imported,
  importedUsdB: Number(report.importedUsdB.toFixed(2)),
  matchedExisting: report.matchedExisting,
  twinSkipped: report.twinSkipped,
  newCountries: report.newCountries,
  byYear: report.byYear,
}, null, 2))

console.log('\nSkipped value-mismatch twins:')
for (const t of twinSkip) {
  console.log(
    `  B ${t.ym} ${t.country} $${t.valueB}B ↔ A ${t.atlasDate} $${((t.atlasUsd || 0) / 1e9).toFixed(3)}B | ${(t.equipment || '').slice(0, 50)}`,
  )
}
