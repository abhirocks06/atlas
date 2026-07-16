// Step 2: Download and parse all DSCA PDFs
// Run: node scripts/dsca-parse-pdfs.mjs
//
// Input:  data/dsca_pdf_urls.json  (from dsca-collect-pdf-urls.js)
// Output: data/fms_notifications.json + data/dsca_parse_log.json

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { extractContractors } from './extract-contractors.mjs'
const require = createRequire(import.meta.url)
// pdf-parse v1.1.1 is CommonJS only
const pdfParse = require('pdf-parse')

const PDF_URLS_PATH = new URL('../data/dsca_pdf_urls.json', import.meta.url).pathname
const OUTPUT_PATH = new URL('../data/fms_notifications.json', import.meta.url).pathname
const LOG_PATH = new URL('../data/dsca_parse_log.json', import.meta.url).pathname

// Country name normalization (DSCA uses ALL CAPS or abbreviations)
const COUNTRY_MAP = {
  'UNITED ARAB EMIRATES': 'United Arab Emirates',
  'UAE': 'United Arab Emirates',
  'KINGDOM OF SAUDI ARABIA': 'Saudi Arabia',
  'SAUDI ARABIA': 'Saudi Arabia',
  'REPUBLIC OF KOREA': 'Republic of Korea',
  'SOUTH KOREA': 'Republic of Korea',
  'TAIWAN': 'Taiwan',
  'TAIPEI ECONOMIC AND CULTURAL REPRESENTATIVE OFFICE': 'Taiwan',
  'TAIPEI ECONOMIC AND CULTURAL REPRESENTATIVE OFFICE IN THE UNITED STATES': 'Taiwan',
  'TAIPEI ECONOMIC AND CULTURAL REPRESENTATIVE OFFICE (TECRO) IN THE UNITED STATES': 'Taiwan',
  'TAIPEI ECONOMIC AND CULTURAL REPRESENTATIVE OFFICE IN THE UNITED STATES (TECRO)': 'Taiwan',
  'TECRO': 'Taiwan',
  'KOREA': 'Republic of Korea',
  'REPUBLIC OF KOREA (ROK)': 'Republic of Korea',
  'THE PHILIPPINES': 'Philippines',
  'REPUBLIC OF THE PHILIPPINES': 'Philippines',
  'KINGDOM OF MOROCCO': 'Morocco',
  'KINGDOM OF SAUDI ARABIA (KSA)': 'Saudi Arabia',
  'GOVERNMENT OF IRAQ': 'Iraq',
  'REPUBLIC OF IRAQ': 'Iraq',
  'THE GOVERNMENT OF KUWAIT': 'Kuwait',
  'GOVERNMENT OF KUWAIT': 'Kuwait',
  'UNITED KINGDOM': 'United Kingdom',
  'NETHERLANDS': 'Netherlands',
  'THE NETHERLANDS': 'Netherlands',
  'CZECH REPUBLIC': 'Czech Republic',
  'NEW ZEALAND': 'New Zealand',
  'REPUBLIC OF THE PHILIPPINES': 'Philippines',
  'PHILIPPINES': 'Philippines',
  'NATO SUPPORT AND PROCUREMENT AGENCY': 'NATO',
  'NATO SUPPORT AND PROCUREMENT AGENCY (NSPA)': 'NATO',
  'NSPA': 'NATO',
  'NORTH ATLANTIC TREATY ORGANIZATION': 'NATO',
  'REPUBLIC OF TURKEY': 'Turkey',
  'REPUBLIC OF ZAMBIA': 'Zambia',
  'REPUBLIC OF GHANA': 'Ghana',
  'TURKEY': 'Turkey',
  'UNITED ARAB EMIRATES (UAE)': 'United Arab Emirates',
  'THE GOVERNMENT OF KUWAIT': 'Kuwait',
  'GOVERNMENT OF KUWAIT': 'Kuwait',
  'INDIA': 'India',
  'MEXICO': 'Mexico',
  'AUSTRALIA': 'Australia',
  'KUWAIT': 'Kuwait',
  'QATAR': 'Qatar',
  'IRAQ': 'Iraq',
  'JAPAN': 'Japan',
  'FRANCE': 'France',
  'GERMANY': 'Germany',
  'SPAIN': 'Spain',
  'ITALY': 'Italy',
  'NORWAY': 'Norway',
  'DENMARK': 'Denmark',
  'SWEDEN': 'Sweden',
  'FINLAND': 'Finland',
  'POLAND': 'Poland',
  'GREECE': 'Greece',
  'TURKEY': 'Turkey',
  'ISRAEL': 'Israel',
  'UKRAINE': 'Ukraine',
  'MOROCCO': 'Morocco',
  'EGYPT': 'Egypt',
  'JORDAN': 'Jordan',
  'OMAN': 'Oman',
  'BAHRAIN': 'Bahrain',
  'PAKISTAN': 'Pakistan',
  'SINGAPORE': 'Singapore',
  'THAILAND': 'Thailand',
  'INDONESIA': 'Indonesia',
  'MALAYSIA': 'Malaysia',
  'VIETNAM': 'Vietnam',
  'CANADA': 'Canada',
  'BELGIUM': 'Belgium',
  'PORTUGAL': 'Portugal',
  'ROMANIA': 'Romania',
  'HUNGARY': 'Hungary',
  'SLOVAKIA': 'Slovakia',
  'BULGARIA': 'Bulgaria',
  'ESTONIA': 'Estonia',
  'LATVIA': 'Latvia',
  'LITHUANIA': 'Lithuania',
  'CROATIA': 'Croatia',
  'AFGHANISTAN': 'Afghanistan',
  'BRAZIL': 'Brazil',
  'CHILE': 'Chile',
  'COLOMBIA': 'Colombia',
  'PERU': 'Peru',
  'KENYA': 'Kenya',
  'NIGERIA': 'Nigeria',
  'SOUTH AFRICA': 'South Africa',
}

function normalizeCountry(raw) {
  if (!raw) return raw
  const upper = raw.toUpperCase().trim()
  if (COUNTRY_MAP[upper]) return COUNTRY_MAP[upper]
  // Strip common governmental prefixes then re-check map
  // "Government of Australia" → "Australia", "The Kingdom of Saudi Arabia" → "Saudi Arabia"
  const stripped = upper
    .replace(/^THE\s+GOVERNMENT\s+OF\s+(?:THE\s+)?/, '')
    .replace(/^GOVERNMENT\s+OF\s+(?:THE\s+)?/, '')
    .replace(/^THE\s+REPUBLIC\s+OF\s+/, '')
    .replace(/^THE\s+KINGDOM\s+OF\s+/, '')
    .replace(/\s*\([^)]+\)\s*$/, '')    // strip trailing "(NSPA)", "(ROK)", "(UAE)" etc.
    .trim()
  if (stripped !== upper && COUNTRY_MAP[stripped]) return COUNTRY_MAP[stripped]
  // If still not matched, title-case the stripped version if simpler
  const best = stripped !== upper ? stripped : upper
  return best.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function parsePressRelease(rawText, meta) {
  // PDFs have 4 identical pages — deduplicate by finding where page 2 starts.
  // Page 2 starts with "Defense Security Cooperation Agency NEWS RELEASE" again.
  // We can't just search for "DSCA" since it also appears in the body text.
  // Instead, look for "Transmittal No." appearing a second time.
  let text = rawText
  const txMarker = 'Transmittal No'
  const firstTx = rawText.indexOf(txMarker)
  if (firstTx >= 0) {
    const secondTx = rawText.indexOf(txMarker, firstTx + 20)
    if (secondTx > firstTx + 20) text = rawText.slice(0, secondTx)
  }

  // Normalize whitespace; fix OCR artifacts
  const fullText = text
    .replace(/\r/g, '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bT [Hh]e\b/g, 'The')
    .replace(/\bW\s+ASHINGTON\b/gi, 'WASHINGTON')   // "W ASHINGTON"
    .replace(/\bWASHIN\s+GTON\b/gi, 'WASHINGTON')   // "WASHIN GTON"
    .replace(/\bmil\s+lio\s*n\b/gi, 'million')       // "mil lio n"
    .replace(/\bbil\s+lio\s*n\b/gi, 'billion')       // "bil lio n"
    .trim()

  // --- Transmittal (from PDF text takes priority over filename) ---
  // Allow optional space in transmittal number ("13- 08" → "13-08")
  const txMatch = fullText.match(/Transmittal\s+No\.?\s*([0-9]{2}-\s*[A-Z0-9]+)/i)
  const transmittal = txMatch ? txMatch[1].replace(/\s/g, '') : (meta.transmittal || null)

  // --- Title line: "Country – System" between transmittal and WASHINGTON ---
  let country = null
  let system = null
  // Try WASHINGTON dateline first; fall back to "On DD Month YYYY" (older format)
  const titleMatch = fullText.match(/Transmittal\s+No\.?\s*[0-9]{2}-\s*[A-Z0-9]+\s+(.+?)\s+(?:WASHINGTON|On\s+\d{1,2}\s+[A-Za-z])/i)
  if (titleMatch) {
    const title = titleMatch[1].trim()
    // Split on spaced dash "Country – System" or "Country - System"
    let dashIdx = title.search(/\s[–—-]\s/)
    if (dashIdx > -1) {
      country = normalizeCountry(title.slice(0, dashIdx).trim())
      system = title.slice(dashIdx + 3).trim()
    } else {
      // Unspaced em/en dash: "Country–System"
      dashIdx = title.search(/[–—]/)
      if (dashIdx > -1) {
        country = normalizeCountry(title.slice(0, dashIdx).trim())
        system = title.slice(dashIdx + 1).trim()
      } else {
        // Unspaced hyphen between letters: "Country-System"
        dashIdx = title.search(/(?<=[A-Za-z])-(?=[A-Za-z0-9])/)
        if (dashIdx > -1) {
          country = normalizeCountry(title.slice(0, dashIdx).trim())
          system = title.slice(dashIdx + 1).trim()
        } else {
          // Single-sided: "Country- System" or "Country -System"
          const m = title.match(/^(.+?)\s?[-–—]{1,2}\s?([A-Z][A-Za-z0-9].*)$/)
          if (m) {
            country = normalizeCountry(m[1].trim())
            system = m[2].trim()
          } else {
            country = normalizeCountry(title)
          }
        }
      }
    }
  }
  // Fallback: use meta.country (from filename), which sometimes has "Country-System" embedded
  // Handles: "QATAR- JAVELIN", "IRAQ -REFURBISHMENT", "FRANCE--GUIDED", "Country–System"
  function splitMeta(mc) {
    // Spaced: " – ", " — ", " - "
    let di = mc.search(/\s[–—-]\s/)
    if (di > -1) return [mc.slice(0, di), mc.slice(di + 3)]
    // Unspaced em/en dash
    di = mc.search(/[–—]/)
    if (di > -1) return [mc.slice(0, di), mc.slice(di + 1)]
    // Hyphen(s) adjacent to uppercase: "Qatar-Javelin", "France--Guided", "Iraq -Refurb", "Qatar- Javelin"
    const m = mc.match(/^(.+?)\s?[-]{1,2}\s?([A-Z].*)$/)
    if (m) return [m[1], m[2]]
    // Bare hyphen between letters
    di = mc.search(/(?<=[A-Za-z])-(?=[A-Za-z0-9])/)
    if (di > -1) return [mc.slice(0, di), mc.slice(di + 1)]
    return [mc, null]
  }
  if (!country && meta.country) {
    const [c, s] = splitMeta(meta.country)
    country = normalizeCountry(c.trim())
    if (s) system = s.trim()
  }
  // If country parsed but system still null, try extracting system from meta.country
  if (country && !system && meta.country) {
    const [, s] = splitMeta(meta.country)
    if (s) system = s.trim()
  }
  // Last-resort: OCR-broken "Transmittal" keyword — find title via transmittal number in text
  if ((!country || !system) && transmittal) {
    const txEsc = transmittal.replace('-', '[-\\s]+')
    const tm2 = fullText.match(new RegExp(`${txEsc}\\s+([A-Z][^0-9].+?)\\s+(?:WASHINGTON|On\\s+\\d{1,2}\\s+[A-Za-z])`, 'i'))
    if (tm2) {
      const title2 = tm2[1].trim()
      let di = title2.search(/\s[–—-]\s/)
      if (di > -1) {
        if (!country) country = normalizeCountry(title2.slice(0, di).trim())
        if (!system) system = title2.slice(di + 3).trim()
      } else {
        di = title2.search(/[–—]|(?<=[A-Za-z])-(?=[A-Za-z0-9])/)
        if (di > -1) {
          if (!country) country = normalizeCountry(title2.slice(0, di).trim())
          if (!system) system = title2.slice(di + 1).trim()
        } else {
          const m = title2.match(/^(.+?)\s?[-–—]{1,2}\s?([A-Z][A-Za-z0-9].*)$/)
          if (m) {
            if (!country) country = normalizeCountry(m[1].trim())
            if (!system) system = m[2].trim()
          } else if (!country) {
            country = normalizeCountry(title2)
          }
        }
      }
    }
  }

  // --- Date ---
  let date = null
  function parseDate(str) {
    // Normalize: "Apr." → "Apr", "Dec, 16" → "Dec 16", "April 9 , 2019" → "April 9,"
    let s = str
      .replace(/([A-Za-z]+)\.\s/, '$1 ')      // "Apr. " → "Apr "
      .replace(/([A-Za-z]+),\s*(\d)/, '$1 $2') // "Dec, 16" → "Dec 16"
      .replace(/\s+,/, ',')                     // "9 ," → "9,"
      .replace(/\.$/, '')                       // trailing period
      .trim()
    // OCR artifact: extra leading digit in year ("12019" → "2019")
    s = s.replace(/\b1(20\d\d)\b/, '$1')
    const d = new Date(s)
    if (!isNaN(d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) return d
    return null
  }
  function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  // "WASHINGTON, February 6, 2026" or "WASHINGTON, D.C., February 6, 2026"
  // Also handles: "Apr. 28, 2017", "April 9 , 2019", "Dec, 16, 2015"
  const dateMatch = fullText.match(/WASHINGTON(?:,\s*D\.?C\.?)?,\s*([A-Za-z]+\.?[,\s]\s*\d{1,2}\s*,\s*\d{4,5})/i)
  if (dateMatch) {
    const d = parseDate(dateMatch[1])
    if (d) date = fmtDate(d)
  }
  // Fallback: old format "Date: 21 May 2004" or "On 21 May 2004" (pre-2009 PDFs)
  if (!date) {
    const oldFmt = fullText.match(/(?:\bDate:|On)\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4,5})/i)
    if (oldFmt) {
      const d = new Date(`${oldFmt[2]} ${oldFmt[1]}, ${oldFmt[3]}`)
      if (!isNaN(d)) date = fmtDate(d)
    }
  }
  // Fallback: first standard date-like string anywhere in text
  if (!date) {
    const anyDate = fullText.match(/([A-Za-z]+\.?[,\s]\s*\d{1,2}\s*,\s*\d{4})/)
    if (anyDate) {
      const d = parseDate(anyDate[1])
      if (d) date = fmtDate(d)
    }
  }

  // --- Cost ---
  // Variants seen across years:
  //   "estimated cost of $X million/billion"
  //   "estimated cost of up to $X million/billion"
  //   "estimated sale price of up to $X million/billion"
  //   "The estimated value is $X million"
  //   "valued at $X million"
  //   "a cost of $X million"
  let costUSD = null
  const costMatch = fullText.match(
    /(?:(?:total\s+)?estimated\s+(?:cost|sale\s+price|value)|valued\s+at|a\s+cost|worth\s+approximately)\s+(?:is\s+)?(?:of\s+)?(?:up\s+to\s+)?\$\s*([0-9,.]+)\s*(million|billion)/i
  )
  if (costMatch) {
    const num = parseFloat(costMatch[1].replace(/,/g, ''))
    costUSD = costMatch[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6
  }
  // Fallback: any dollar amount in millions/billions in the text
  if (!costUSD) {
    const anyAmount = fullText.match(/\$\s*([0-9,.]+)\s*(million|billion)/i)
    if (anyAmount) {
      const num = parseFloat(anyAmount[1].replace(/,/g, ''))
      costUSD = anyAmount[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6
    }
  }

  // --- Contractor(s) ---
  // Patterns:
  //   "The principal contractor will be Leidos, located in Reston, VA."
  //   "The principal contractor for the BQM-177A SSATs will be Kratos Defense, located in Sacramento, CA."
  //   "The principal contractor will be AM General LLC, located in Auburn Hills, MI and Mishawaka, IN."
  //   "The principal contractors will be A, City, ST; and B, City, ST."
  //   Multiple "principal contractor for X will be…" sentences → joined with " / "
  //   "The principal contractor(s) will be determined from approved vendors." → null (valid)
  //   "there is no prime contractor" → null (valid)
  const { contractor, contractorLocation } = extractContractors(fullText)

  // --- Description (the "has requested" paragraph — most informative part) ---
  let description = null
  const descMatch = fullText.match(
    /has requested\s+(?:to (?:buy|purchase)\s+)?(.+?)(?:\s*The estimated total cost|\s*This proposed sale will|\s*The proposed sale of)/i
  )
  if (descMatch) {
    description = descMatch[1].replace(/\s+/g, ' ').trim()
    if (description.length > 2000) description = description.slice(0, 2000) + '…'
  }

  // --- Confidence flags (only critical missing fields) ---
  const flags = []
  if (!date) flags.push('NO_DATE')
  if (!costUSD) flags.push('NO_COST')
  if (!system) flags.push('NO_SYSTEM')

  return {
    date,
    transmittal,
    country,
    system,
    costUSD,
    contractor: contractor || null,
    contractorLocation: contractorLocation || null,
    description: description || null,
    sourceUrl: meta.href,
    _flags: flags.length > 0 ? flags : undefined,
  }
}

async function downloadAndParse(pdfEntry) {
  let { href, filename, transmittal, country } = pdfEntry
  // Fallback: extract transmittal + country from filename if not in meta
  // e.g. "MEXICO_14-25.PDF" → transmittal="14-25", country="MEXICO"
  if (!transmittal && filename) {
    const m = filename.match(/[_\s-](\d{2}-[\dA-Z]+)(?:\.|_|\s|$)/i)
    if (m) transmittal = m[1]
  }
  if (!country && filename) {
    const m = filename.match(/^([A-Za-z][A-Za-z_]+?)(?:[_\s]\d{2}-|\.)/i)
    if (m) country = m[1].replace(/_/g, ' ')
  }
  try {
    const res = await fetch(href)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buffer = Buffer.from(await res.arrayBuffer())
    const parsed = await pdfParse(buffer)
    return parsePressRelease(parsed.text, { href, filename, transmittal, country })
  } catch (e) {
    return {
      date: null,
      transmittal,
      country: country ? normalizeCountry(country) : null,
      system: null,
      costUSD: null,
      contractor: null,
      contractorLocation: null,
      sourceUrl: href,
      _flags: [`DOWNLOAD_ERROR: ${e.message}`],
    }
  }
}

// ── Main (only when run directly — importing must not trigger a full reparse) ─

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]

if (isMain) {
if (!existsSync(PDF_URLS_PATH)) {
  console.error(`Missing ${PDF_URLS_PATH}`)
  console.error('Run the browser console script first to collect PDF URLs.')
  process.exit(1)
}

const pdfList = JSON.parse(readFileSync(PDF_URLS_PATH, 'utf8'))
console.log(`Loaded ${pdfList.length} PDF URLs`)

const results = []
const log = []
const CONCURRENCY = 5
const DELAY_MS = 200

for (let i = 0; i < pdfList.length; i += CONCURRENCY) {
  const batch = pdfList.slice(i, i + CONCURRENCY)
  process.stdout.write(`\rParsing ${i + 1}–${Math.min(i + CONCURRENCY, pdfList.length)} / ${pdfList.length}...`)

  const batchResults = await Promise.all(batch.map(entry => downloadAndParse(entry)))

  for (const r of batchResults) {
    const { _flags, ...clean } = r
    if (!_flags) {
      results.push(clean)
    } else {
      log.push({ ...clean, flags: _flags })
      // Still add to results but with nulls — reviewable
      results.push(clean)
    }
  }

  await new Promise(r => setTimeout(r, DELAY_MS))
}

console.log('\n')

// Sort by date
results.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

// Deduplicate: same transmittal + same country → keep the record with most non-null fields
// (Handles cases where DSCA library has same PDF uploaded under multiple filenames)
function countFields(r) {
  return ['date','transmittal','country','system','costUSD','contractor','description']
    .filter(f => r[f] != null).length
}
const deduped = []
const seen = new Map()  // key: "transmittal|country"
for (const r of results) {
  if (!r.transmittal || !r.country) { deduped.push(r); continue }
  const key = `${r.transmittal}|${r.country}`
  const existing = seen.get(key)
  if (!existing) {
    seen.set(key, r)
    deduped.push(r)
  } else if (countFields(r) > countFields(existing)) {
    // Replace with more complete record
    const idx = deduped.indexOf(existing)
    deduped[idx] = r
    seen.set(key, r)
  }
  // else: discard the duplicate
}
const dedupCount = results.length - deduped.length
if (dedupCount > 0) console.log(`Deduplicated: removed ${dedupCount} duplicate records`)
// Re-sort after dedup (replacement may have disrupted sort order)
deduped.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

const flagged = log.filter(l => l.flags?.length > 0)
console.log(`✓ Parsed: ${deduped.length - flagged.length} clean`)
console.log(`⚠ Flagged for review: ${flagged.length}`)

writeFileSync(OUTPUT_PATH, JSON.stringify(deduped, null, 2))
writeFileSync(LOG_PATH, JSON.stringify(flagged, null, 2))

console.log(`\nWrote ${deduped.length} records → data/fms_notifications.json`)
console.log(`Wrote ${flagged.length} flagged records → data/dsca_parse_log.json`)

if (flagged.length > 0) {
  console.log('\n── Flagged records ──')
  flagged.forEach(r => {
    console.log(`  ${r.transmittal || '?'} ${r.country || '?'} → ${r.flags.join(', ')}`)
  })
}
}
