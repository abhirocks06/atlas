/**
 * Post-processing normalization for fms_notifications.json
 * - Normalizes country names to canonical forms
 * - Fixes HTML entities in text fields
 * - Nulls out cost values that are clearly erroneous (> $30B single-notification max)
 */

import { readFileSync, writeFileSync } from 'fs'

const RAW_PATH = 'data/fms_notifications.json'
const OUT_PATH = 'data/fms_notifications.json'

const data = JSON.parse(readFileSync(RAW_PATH, 'utf8'))

// Country name normalization map — variants → canonical
const COUNTRY_NORM = {
  // Türkiye variants
  'Republic of T[uuml]rkiye': 'Turkey',
  'T[uuml]rkiye': 'Turkey',
  'Türkiye': 'Turkey',
  'Republic of Türkiye': 'Turkey',
  'Republic of Turkey': 'Turkey',

  // "the X" → "X"
  'the Czech Republic': 'Czech Republic',
  'the Netherlands': 'Netherlands',
  'The Netherlands': 'Netherlands',
  'the Philippines': 'Philippines',
  'the Republic of Bulgaria': 'Bulgaria',
  'the Republic of Korea': 'Republic of Korea',
  'the Republic of Latvia': 'Latvia',
  'the Ukraine': 'Ukraine',
  'the United Arab Emirates': 'United Arab Emirates',
  'the United Kingdom': 'United Kingdom',

  // "Republic of X" → canonical
  'Republic of Korea (ROK)': 'Republic of Korea',
  'Republic of Latvia': 'Latvia',
  'Republic of Poland': 'Poland',
  'Republic of Kosovo': 'Kosovo',
  'Republic of Zambia': 'Zambia',

  // "Kingdom of X" → canonical
  'Kingdom of Saudi Arabia': 'Saudi Arabia',
  'Kingdom of Morocco': 'Morocco',

  // Taipei → Taiwan
  'Taipei Economic and Cultural': 'Taiwan',
  'Taipei Economic and Cultural Representative Office': 'Taiwan',

  // Not countries — null them
  'NATO Support and Procurement Agency': null,
  'High Explosive Obstacle Reduction': null,
  'Systems': null,
  'Trainer': null,
}

function decodeHtmlEntities(str) {
  if (!str) return str
  return str
    .replace(/\[uuml\]/g, 'ü')
    .replace(/\[auml\]/g, 'ä')
    .replace(/\[ouml\]/g, 'ö')
    .replace(/\[eacute\]/g, 'é')
    .replace(/\[egrave\]/g, 'è')
    .replace(/\[agrave\]/g, 'à')
    .replace(/\[ntilde\]/g, 'ñ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, '')
}

// Max plausible single-notification cost: $30B
// The largest real FMS notifications in recent years are ~$23B
const MAX_PLAUSIBLE_COST = 30e9

let countryFixes = 0
let costFixes = 0

const normalized = data.map(record => {
  const out = { ...record }

  // Fix HTML entities everywhere
  for (const key of ['country', 'system', 'contractor', 'contractorLocation']) {
    if (out[key]) out[key] = decodeHtmlEntities(out[key])
  }

  // Normalize country
  if (out.country !== undefined && out.country !== null) {
    const norm = COUNTRY_NORM[out.country]
    if (norm !== undefined) {
      out.country = norm  // may be null (for non-countries)
      countryFixes++
    }
  }

  // Null out implausible costs
  if (out.costUSD !== null && out.costUSD > MAX_PLAUSIBLE_COST) {
    console.log(`  Nulling implausible cost $${(out.costUSD / 1e9).toFixed(1)}B for ${out.country ?? 'unknown'} (${out._docNumber ?? out.transmittal})`)
    out.costUSD = null
    costFixes++
  }

  return out
})

// Remove internal scraper fields from output
const clean = normalized.map(({ _source, _docNumber, _title, ...rest }) => rest)

writeFileSync(OUT_PATH, JSON.stringify(clean, null, 2))

const withCountry = clean.filter(r => r.country)
const uniqueCountries = new Set(withCountry.map(r => r.country)).size
const totalCost = withCountry.reduce((s, r) => s + (r.costUSD ?? 0), 0)

console.log(`\nNormalization complete:`)
console.log(`  Country fixes: ${countryFixes}`)
console.log(`  Cost fixes: ${costFixes}`)
console.log(`  Records with country: ${withCountry.length}`)
console.log(`  Unique countries: ${uniqueCountries}`)
console.log(`  Total value: $${(totalCost / 1e9).toFixed(1)}B`)
console.log(`  Output: ${OUT_PATH}`)
