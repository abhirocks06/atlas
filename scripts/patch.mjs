/**
 * Patch scraper: fetches all FR arms-sales notifications we don't yet have,
 * parses them, and merges into fms_notifications.json
 */

import { readFileSync, writeFileSync } from 'fs'

const EXISTING_PATH = 'data/fms_notifications.json'
const BASE_URL = 'https://www.federalregister.gov'
const DELAY_MS = 300

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchJSON(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (e) {
      if (attempt === 2) throw e
      await sleep(1000)
    }
  }
}

async function fetchText(docNumber, date) {
  const [year, month, day] = date.split('-')
  const url = `${BASE_URL}/documents/full_text/text/${year}/${month}/${day}/${docNumber}.txt`
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      return await res.text()
    } catch (e) {
      if (attempt === 2) return null
      await sleep(1000)
    }
  }
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function parseText(text, date) {
  const t = stripHtml(text)

  // Transmittal
  const txMatch = t.match(/Transmittal\s+No\.?\s*([\w\d-]+)/i)
  const transmittal = txMatch ? txMatch[1].replace(/\.$/, '') : null

  // Country
  let country = null
  const purchaserMatch = t.match(/Prospective Purchaser[:\s]+(?:\(U\)\s*)?(?:Government of\s+)?([^\n(]+?)(?:\s*\n|\s{2,}|\s*\()/i)
  if (purchaserMatch) {
    country = purchaserMatch[1].trim().replace(/\.$/, '')
    // Clean common prefixes
    country = country.replace(/^(?:the\s+)?(?:Government\s+of\s+)?/i, '').trim()
  }

  // System - look for MDE block
  let system = null
  const mdeMatch = t.match(/Major Defense Equipment[^:]*:(.+?)(?=Other Defense Articles|Non-MDE|(?:\n\s*\n)|$)/is)
  if (mdeMatch) {
    const mdeText = mdeMatch[1].trim()
    const firstLine = mdeText.split('\n')[0].trim()
    system = firstLine.replace(/^\(\w+\)\s*/, '').replace(/^\d+[\s\)]+/, '').trim().slice(0, 200)
  }

  // Cost - find largest dollar amount
  let costUSD = null
  const costMatches = [...t.matchAll(/\$\s*([\d,\.]+)\s*(billion|million|thousand)?/gi)]
  for (const m of costMatches) {
    const raw = parseFloat(m[1].replace(/,/g, ''))
    if (isNaN(raw)) continue
    const unit = (m[2] || '').toLowerCase()
    let value = raw
    if (unit === 'billion') value = raw * 1e9
    else if (unit === 'million') value = raw * 1e6
    else if (unit === 'thousand') value = raw * 1e3
    if (!costUSD || value > costUSD) costUSD = value
  }
  if (costUSD && costUSD > 30e9) costUSD = null // implausible

  // Contractor
  let contractor = null, contractorLocation = null
  const conMatch = t.match(/principal contractor will be ([^,\.]+(?:,\s*[^,\.]+)*?),\s*([A-Za-z\s]+,\s*[A-Z]{2})\b/i)
  if (conMatch) {
    contractor = conMatch[1].trim()
    contractorLocation = conMatch[2].trim()
  } else {
    const conSimple = t.match(/principal contractor will be ([^\.]+)\./i)
    if (conSimple) contractor = conSimple[1].trim().slice(0, 100)
  }

  return { date, transmittal, country, system, costUSD, contractor, contractorLocation }
}

// Normalize country name (same as normalize.mjs)
const COUNTRY_NORM = {
  'Republic of T[uuml]rkiye': 'Turkey', 'Türkiye': 'Turkey', 'Republic of Türkiye': 'Turkey',
  'Republic of Turkey': 'Turkey', 'the Czech Republic': 'Czech Republic',
  'the Netherlands': 'Netherlands', 'The Netherlands': 'Netherlands',
  'the Philippines': 'Philippines', 'the Republic of Bulgaria': 'Bulgaria',
  'the Republic of Korea': 'Republic of Korea', 'the Republic of Latvia': 'Latvia',
  'the Ukraine': 'Ukraine', 'the United Arab Emirates': 'United Arab Emirates',
  'the United Kingdom': 'United Kingdom', 'Republic of Korea (ROK)': 'Republic of Korea',
  'Republic of Latvia': 'Latvia', 'Republic of Poland': 'Poland',
  'Republic of Kosovo': 'Kosovo', 'Republic of Zambia': 'Zambia',
  'Kingdom of Saudi Arabia': 'Saudi Arabia', 'Kingdom of Morocco': 'Morocco',
  'Taipei Economic and Cultural': 'Taiwan', 'NATO Support and Procurement Agency': null,
}

function normalizeCountry(c) {
  if (!c) return null
  if (c in COUNTRY_NORM) return COUNTRY_NORM[c]
  return c
}

// ---- Main ----

const existing = JSON.parse(readFileSync(EXISTING_PATH, 'utf8'))

// Build set of (date, transmittal) pairs we already have
const haveKeys = new Set()
for (const r of existing) {
  if (r.transmittal && r.date) haveKeys.add(`${r.date}|${r.transmittal}`)
}
// Also build set of document numbers we have (they're in the URL pattern)
// Since we stripped _docNumber, use transmittal+date as dedup key

console.log(`Existing records: ${existing.length}`)
console.log('Fetching FR index...')

// Fetch all pages
let nextUrl = `${BASE_URL}/api/v1/articles.json?` + new URLSearchParams([
  ['conditions[term]', 'arms sales notification'],
  ['conditions[publication_date][gte]', '2023-01-01'],
  ['conditions[publication_date][lte]', '2026-06-17'],
  ['per_page', '100'],
  ['order', 'newest'],
  ['fields[]', 'title'],
  ['fields[]', 'publication_date'],
  ['fields[]', 'document_number'],
]).toString()

const allStubs = []
let page = 0
while (nextUrl) {
  page++
  const data = await fetchJSON(nextUrl)
  allStubs.push(...(data.results || []))
  nextUrl = data.next_page_url || null
  process.stdout.write(`\r  Page ${page}, stubs: ${allStubs.length}`)
  if (nextUrl) await sleep(DELAY_MS)
}
console.log(`\nTotal stubs from FR: ${allStubs.length}`)

// Filter to arms sales notifications only
const FMS_TITLE = /arms\s+sales?\s+notification/i
const fmsStubs = allStubs.filter(s => FMS_TITLE.test(s.title || ''))
console.log(`Arms sales notifications: ${fmsStubs.length}`)

// Identify which ones to fetch (not already in our data by doc number)
// We'll check by parsing text and comparing transmittal+date
const toFetch = []
for (const stub of fmsStubs) {
  // Rough pre-filter: skip if we already have lots of records for this date
  // (We'll deduplicate properly after parsing)
  toFetch.push(stub)
}

console.log(`Fetching ${toFetch.length} notifications (will skip duplicates after parse)...`)

const newRecords = []
let fetched = 0, skipped = 0, errors = 0

for (const stub of toFetch) {
  fetched++
  process.stdout.write(`\r  ${fetched}/${toFetch.length} fetched, ${newRecords.length} new, ${skipped} dupes, ${errors} errors`)

  const text = await fetchText(stub.document_number, stub.publication_date)
  await sleep(DELAY_MS)

  if (!text) { errors++; continue }

  let record
  try {
    record = parseText(text, stub.publication_date)
  } catch (e) {
    errors++
    continue
  }

  record.country = normalizeCountry(record.country)

  // Skip non-countries
  if (record.country === null && record.transmittal === null) { skipped++; continue }

  // Dedup check
  const key = `${record.date}|${record.transmittal}`
  if (record.transmittal && haveKeys.has(key)) { skipped++; continue }

  if (record.transmittal) haveKeys.add(key)
  newRecords.push(record)
}

console.log(`\n\nNew records found: ${newRecords.length}`)
console.log(`Skipped (dupes): ${skipped}`)
console.log(`Errors: ${errors}`)

if (newRecords.length > 0) {
  const merged = [...existing, ...newRecords]
  merged.sort((a, b) => b.date.localeCompare(a.date))

  const { _source, _docNumber, _title, ...rest } = merged[0]
  writeFileSync(EXISTING_PATH, JSON.stringify(merged.map(r => {
    const { _source, _docNumber, _title, ...clean } = r
    return clean
  }), null, 2))

  console.log(`Total records after merge: ${merged.length}`)

  const withCountry = merged.filter(r => r.country)
  const countries = new Set(withCountry.map(r => r.country))
  const total = withCountry.reduce((s, r) => s + (r.costUSD ?? 0), 0)
  console.log(`Countries: ${countries.size}, Total value: $${(total / 1e9).toFixed(1)}B`)

  // Show sample of new records
  console.log('\nSample new records:')
  newRecords.slice(0, 10).forEach(r =>
    console.log(`  ${r.date} | ${r.transmittal} | ${r.country} | ${r.system?.slice(0, 40) ?? 'n/a'} | $${r.costUSD ? (r.costUSD/1e6).toFixed(0)+'M' : '?'}`)
  )
} else {
  console.log('No new records to add.')
}
