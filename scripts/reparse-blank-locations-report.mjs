/**
 * Report-only PDF reparse for rows with a contractor but blank location.
 * Does NOT write to fms_notifications.json — outputs a side report for cross-check.
 *
 * Run: node scripts/reparse-blank-locations-report.mjs
 *
 * Writes:
 *   tmp_location_reparse/report.json
 *   tmp_location_reparse/report.tsv
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { extractContractors } from './extract-contractors.mjs'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '../data/fms_notifications.json')
const OUT_DIR = join(__dirname, '../tmp_location_reparse')

const CONCURRENCY = 5
const DELAY_MS = 250

const USG =
  /U\.?S\.?\s+(Government|Army|Navy|Air Force|Marine)|inventory|vendors TBD|NAVAIR|No contractor specified/i

function normalizePdfText(rawText) {
  let text = rawText
  const txMarker = 'Transmittal No'
  const firstTx = rawText.indexOf(txMarker)
  if (firstTx >= 0) {
    const secondTx = rawText.indexOf(txMarker, firstTx + 20)
    if (secondTx > firstTx + 20) text = rawText.slice(0, secondTx)
  }
  return text
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function contractorsFromUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const parsed = await pdfParse(buffer)
  return extractContractors(normalizePdfText(parsed.text))
}

function tsvEscape(s) {
  const v = s == null ? '' : String(s)
  if (/[\t\n\r"]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const targets = data
  .map((n, index) => ({ n, index }))
  .filter(
    ({ n }) =>
      n.contractor?.trim() &&
      !n.contractorLocation &&
      !USG.test(n.contractor) &&
      /media\.defense\.gov|\.pdf/i.test(n.sourceUrl || ''),
  )

console.log(`Blank-location rows with PDF URLs (report only): ${targets.length}`)
console.log(`Live data will NOT be modified.\n`)

const rows = []
let withLoc = 0
let stillBlank = 0
let errors = 0

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const batch = targets.slice(i, i + CONCURRENCY)
  process.stdout.write(
    `\r${i + 1}–${Math.min(i + CONCURRENCY, targets.length)} / ${targets.length} (loc found ${withLoc})`,
  )

  const results = await Promise.all(
    batch.map(async ({ n, index }) => {
      try {
        const parsed = await contractorsFromUrl(n.sourceUrl)
        return { index, n, parsed, error: null }
      } catch (e) {
        return { index, n, parsed: null, error: e.message }
      }
    }),
  )

  for (const { index, n, parsed, error } of results) {
    if (error) {
      errors++
      rows.push({
        index,
        transmittal: n.transmittal,
        country: n.country,
        system: n.system,
        sourceUrl: n.sourceUrl,
        currentContractor: n.contractor,
        currentLocation: n.contractorLocation,
        parsedContractor: null,
        parsedLocation: null,
        status: 'error',
        error,
        suggestedAction: 'skip',
      })
      continue
    }

    const parsedContractor = parsed?.contractor ?? null
    const parsedLocation = parsed?.contractorLocation ?? null
    let status
    let suggestedAction

    if (parsedLocation) {
      withLoc++
      status = 'location_found'
      suggestedAction = 'fill_location_only'
    } else if (parsedContractor) {
      stillBlank++
      status = 'contractor_only_no_location'
      suggestedAction = 'skip'
    } else {
      stillBlank++
      status = 'parse_empty'
      suggestedAction = 'skip'
    }

    rows.push({
      index,
      transmittal: n.transmittal,
      country: n.country,
      system: n.system,
      sourceUrl: n.sourceUrl,
      currentContractor: n.contractor,
      currentLocation: n.contractorLocation,
      parsedContractor,
      parsedLocation,
      status,
      error: null,
      suggestedAction,
    })
  }

  await new Promise(r => setTimeout(r, DELAY_MS))
}

mkdirSync(OUT_DIR, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  note: 'Report only — fms_notifications.json was not modified. Review then apply approved rows.',
  summary: {
    targets: targets.length,
    locationFound: withLoc,
    stillBlank,
    errors,
  },
  rows,
}

writeFileSync(join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2) + '\n')

const header = [
  'status',
  'suggestedAction',
  'transmittal',
  'country',
  'system',
  'currentContractor',
  'parsedContractor',
  'parsedLocation',
  'sourceUrl',
  'error',
]
const tsvLines = [
  header.join('\t'),
  ...rows.map(r =>
    header.map(k => tsvEscape(r[k])).join('\t'),
  ),
]
writeFileSync(join(OUT_DIR, 'report.tsv'), tsvLines.join('\n') + '\n')

console.log(`\n\nLocation found: ${withLoc}`)
console.log(`Still blank / no loc: ${stillBlank}`)
console.log(`Errors: ${errors}`)
console.log(`Wrote → tmp_location_reparse/report.json`)
console.log(`Wrote → tmp_location_reparse/report.tsv`)
console.log(`(fms_notifications.json untouched)`)
