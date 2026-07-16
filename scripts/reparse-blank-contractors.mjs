// Re-download DSCA PDFs for notifications with blank contractors and fill
// contractor / contractorLocation only (does not rewrite other fields).
//
// Run: node scripts/reparse-blank-contractors.mjs

import { readFileSync, writeFileSync } from 'fs'
import { createRequire } from 'module'
import { extractContractors } from './extract-contractors.mjs'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

const DATA_PATH = new URL('../data/fms_notifications.json', import.meta.url).pathname
const LOG_PATH = new URL('../data/dsca_contractor_reparse_log.json', import.meta.url).pathname

const CONCURRENCY = 5
const DELAY_MS = 250

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

const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
const targets = data
  .map((n, index) => ({ n, index }))
  .filter(({ n }) => !n.contractor?.trim() && /media\.defense\.gov|\.pdf/i.test(n.sourceUrl || ''))

console.log(`Blank contractor rows with PDF URLs: ${targets.length}`)

const log = []
let filled = 0
let stillBlank = 0
let errors = 0

for (let i = 0; i < targets.length; i += CONCURRENCY) {
  const batch = targets.slice(i, i + CONCURRENCY)
  process.stdout.write(`\r${i + 1}–${Math.min(i + CONCURRENCY, targets.length)} / ${targets.length} (filled ${filled})`)

  const results = await Promise.all(
    batch.map(async ({ n, index }) => {
      try {
        const { contractor, contractorLocation } = await contractorsFromUrl(n.sourceUrl)
        return { index, transmittal: n.transmittal, country: n.country, system: n.system, contractor, contractorLocation, error: null }
      } catch (e) {
        return { index, transmittal: n.transmittal, country: n.country, system: n.system, contractor: null, contractorLocation: null, error: e.message }
      }
    })
  )

  for (const r of results) {
    if (r.error) {
      errors++
      log.push({ ...r, status: 'error' })
      continue
    }
    if (r.contractor) {
      data[r.index].contractor = r.contractor
      data[r.index].contractorLocation = r.contractorLocation
      filled++
      log.push({ transmittal: r.transmittal, country: r.country, system: r.system, contractor: r.contractor, contractorLocation: r.contractorLocation, status: 'filled' })
    } else {
      stillBlank++
      log.push({ transmittal: r.transmittal, country: r.country, system: r.system, status: 'still_blank' })
    }
  }

  await new Promise(r => setTimeout(r, DELAY_MS))
}

writeFileSync(DATA_PATH, JSON.stringify(data, null, 2) + '\n')
writeFileSync(LOG_PATH, JSON.stringify(log, null, 2))

console.log(`\n\nFilled: ${filled}`)
console.log(`Still blank (likely TBD / no prime / parser miss): ${stillBlank}`)
console.log(`Errors: ${errors}`)
console.log(`Wrote updates → data/fms_notifications.json`)
console.log(`Wrote log → data/dsca_contractor_reparse_log.json`)
