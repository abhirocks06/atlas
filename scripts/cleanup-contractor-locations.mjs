/**
 * Cleanup contractor / contractorLocation formatting in fms_notifications.json.
 *
 * - Expands state abbrevs (FL → Florida)
 * - Pulls "Company, located in City" blobs out of the location field into paired lists
 * - Strips Inc-/prose junk from locations
 * - Hand-fixes a few known broken rows
 *
 * Run: node scripts/cleanup-contractor-locations.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '../data/fms_notifications.json')
const dry = process.argv.includes('--dry')

const STATE = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
}
const STATE_NAMES = Object.values(STATE).join('|')

function expandText(s) {
  if (!s) return s
  let out = String(s)
  out = out.replace(/\bSt Louis\b/g, 'St. Louis')
  out = out.replace(/\bFt Worth\b/g, 'Fort Worth')
  out = out.replace(/,\s*([A-Z]{2})\.?(?=\s*(?:\/|$|;|,|\sand\b))/g, (_, ab) => {
    return STATE[ab] ? `, ${STATE[ab]}` : `, ${ab}`
  })
  // "City ST" before / or end (e.g. "Mesa AZ /" or "Mesa, AZ")
  out = out.replace(
    /\b([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.']+){0,3}),?\s+([A-Z]{2})\.?(?=\s*(?:\/|$|;))/g,
    (m, city, ab) => {
      if (!STATE[ab] || STATE[city.toUpperCase()]) return m
      return `${city}, ${STATE[ab]}`
    },
  )
  return out.replace(/\s+/g, ' ').trim()
}

function cleanPlace(p) {
  if (p == null) return null
  let s = String(p)
    .replace(/^and\s+/i, '')
    .replace(/^Inc\.?\s+/i, '')
    .replace(/\bUSA\b/gi, '')
    .replace(/,?\s*for the .+$/i, '')
    .replace(/^with offices based in\s+/i, '')
    .replace(/[;,]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s || /^(Inc|LLC|Corp|Ltd|U|the)\.?$/i.test(s)) return null
  s = expandText(s)
  return s || null
}

function looksCompany(s) {
  if (!s || s.length < 2) return false
  return /\b(Inc|LLC|Corp\.?|Company|Corporation|Systems|Technologies|Martin|Boeing|Raytheon|RTX|Lockheed|Northrop|Harris|Leidos|BAE|General|Electric|Pratt|Whitney|Insitu|Valiant|Sierra|Sabena|V2X|Allison|Cummins|Snap|Aces|Textron|Bell|Kongsberg|Honeywell|Exelis|Cubic|Booz|Marvin|Goodrich|Zenetex|PROJECTXYZ|Industrial|Kay|Sigmatech|Kellogg|Ordnance|Meggitt|Leonardo|Thales|Saab|CoAspire|Zone)\b/i.test(
    s,
  )
}

function looksPlace(s) {
  if (!s) return false
  return (
    new RegExp(`\\b(${STATE_NAMES})\\b`, 'i').test(s) ||
    /,\s*[A-Z]{2}\b/.test(s) ||
    /\b(Belgium|Canada|Sweden|Germany|Italy|United Kingdom|Netherlands|Ontario|Quebec)\b/i.test(s)
  )
}

/** Extract company+place pairs from a location blob that leaked companies. */
function extractFromLocationBlob(loc) {
  const entries = []
  const parts = loc
    .split(/\s*;\s*/)
    .flatMap(p => p.split(/\s*,\s*and\s+(?=[A-Z])/))
    .map(p => p.replace(/^and\s+/i, '').trim())
    .filter(Boolean)

  for (const part of parts) {
    let m = part.match(/^(.+?),\s*located in\s+(.+)$/i)
    if (m && looksCompany(m[1])) {
      const places = splitMultiPlaces(m[2])
      for (const place of places) entries.push({ name: stripInc(m[1]), location: place })
      continue
    }

    m = part.match(new RegExp(`^(.+?,\\s*(?:[A-Z]{2}|${STATE_NAMES}))\\s+and\\s+(.+)$`, 'i'))
    if (m) {
      const place = cleanPlace(m[1])
      if (place) entries.push({ name: null, location: place })
      const rest = extractFromLocationBlob(m[2])
      if (rest.length) entries.push(...rest)
      else if (looksCompany(m[2])) entries.push({ name: stripInc(m[2]), location: null })
      continue
    }

    m = part.match(/^(.+?)\s+in\s+(.+)$/i)
    if (m && looksCompany(m[1]) && looksPlace(m[2])) {
      entries.push({ name: stripInc(m[1]), location: cleanPlace(m[2]) })
      continue
    }

    if (looksCompany(part) && !looksPlace(part)) {
      entries.push({ name: stripInc(part), location: null })
      continue
    }

    if (looksPlace(part)) {
      const place = cleanPlace(part)
      if (place) entries.push({ name: null, location: place })
    }
  }
  return entries
}

function splitMultiPlaces(text) {
  const found = []
  const re = new RegExp(
    `([A-Za-z .'-]+?),\\s*([A-Z]{2}|${STATE_NAMES})(?=\\s*(?:,\\s*and\\s+|\\s+and\\s+|$))`,
    'gi',
  )
  let m
  while ((m = re.exec(text)) !== null) {
    const p = cleanPlace(`${m[1]}, ${m[2]}`)
    if (p) found.push(p)
  }
  if (found.length) return found
  const one = cleanPlace(text)
  return one ? [one] : []
}

function stripInc(name) {
  return name.replace(/,?\s*Inc\.?$/i, '').replace(/^and\s+/i, '').trim()
}

function joinPaired(names, locs) {
  while (locs.length < names.length) locs.push(null)
  const locStr = locs
    .slice(0, names.length)
    .map(x => x || '')
    .join(' / ')
    .replace(/(?: \/ )+$/g, '')
    .replace(/^(?: \/ )+/g, '')
  return {
    contractor: names.join(' / '),
    contractorLocation: locStr || null,
  }
}

/** Hand fixes for rows that need explicit knowledge. */
function specialCase(n) {
  switch (n.transmittal) {
    case '09-46':
      return {
        contractor: 'Javelin Joint Venture / Lockheed Martin',
        contractorLocation: 'Tucson, Arizona / Orlando, Florida',
      }
    case '10-67':
      return {
        contractor: 'General Dynamics / Honeywell International / Allison Transmission',
        contractorLocation: 'Sterling Heights, Michigan / Phoenix, Arizona / Indianapolis, Indiana',
      }
    case '10-68':
      return {
        contractor: 'General Dynamics Land Systems / Raytheon Corporation',
        contractorLocation: 'Sterling Heights, Michigan / Tucson, Arizona',
      }
    case '09-08':
      return {
        contractor: 'General Dynamics Land Systems / Honeywell International / General Motors Allison Transmission',
        contractorLocation: 'Sterling Heights, Michigan / / Detroit, Michigan',
      }
    case '12-40':
      return {
        contractor: 'Lockheed Martin Space Systems Corporation / Raytheon Corporation',
        contractorLocation: ' / Andover, Massachusetts',
      }
    case '16-15':
      return {
        contractor: 'Boeing / Lockheed Martin',
        contractorLocation: ' / Orlando, Florida',
      }
    case '15-53':
      return {
        contractor: 'Lockheed Martin',
        contractorLocation: 'Moorestown, New Jersey',
      }
    case '10-09':
      return {
        contractor: 'Northrop Grumman / Raytheon',
        contractorLocation: null,
      }
    case '17-77':
      return {
        contractor: 'Raytheon Missile Systems / BAE Systems',
        contractorLocation: 'Tucson, Arizona / Aberdeen, South Dakota',
      }
    case '20-12':
      return {
        contractor: 'Boeing Corporation / Raytheon Company',
        contractorLocation: 'Everett, Washington / Waltham, Massachusetts',
      }
    case '17-68':
      return {
        contractor: n.contractor,
        contractorLocation: null,
      }
    case '17-28':
      return {
        contractor: 'Lockheed Martin Space Systems Corporation / Raytheon Corporation',
        contractorLocation: 'Dallas, Texas / Andover, Massachusetts',
      }
    case '19-24':
      return {
        contractor:
          'NATO Support and Procurement Agency (NSPA) / Northrop Grumman Innovation Systems / Tornado Management Agency (NETMA)',
        contractorLocation: 'Germany / Ridgecrest, California / Germany',
      }
    case '24-84':
      return {
        contractor: 'BAE Systems',
        contractorLocation: 'York, Pennsylvania',
      }
    case '09-25':
      return {
        contractor: n.contractor
          .replace(/\bCT Goodrich\b/, 'Goodrich')
          .replace(/\bTX Northrop-Grumman\b/, 'Northrop-Grumman'),
        contractorLocation: expandText(n.contractorLocation.replace(/\bInc\s+/i, '')),
      }
    default:
      return null
  }
}

function cleanupRow(n) {
  const special = specialCase(n)
  if (special) return special

  let c = (n.contractor || '').trim()
  let l = (n.contractorLocation || '').trim()
  if (!c && !l) return null

  const beforeC = c
  const beforeL = l

  // Location is only a leaked "and Company in City" (no place for the primary)
  if (l && /^and\s+/i.test(l) && looksCompany(l)) {
    const rest = l.replace(/^and\s+/i, '').trim()
    const m = rest.match(/^(.+?)\s+in\s+(.+)$/i)
    if (m && looksCompany(m[1]) && looksPlace(m[2])) {
      c = c ? `${c} / ${stripInc(m[1])}` : stripInc(m[1])
      // Keep primary loc unknown; append new company loc — need primary loc from contractor embed if any
      const primaryEmbed = c.split(/\s*\/\s*/)[0].match(/\s+in\s+(.+)$/i)
      const primaryLoc = primaryEmbed ? cleanPlace(primaryEmbed[1]) : null
      // If original contractor had "AM General in South Bend, Indiana", split it
      const parts = (n.contractor || '').split(/\s*\/\s*/)
      const rebuiltNames = []
      const rebuiltLocs = []
      for (const part of parts) {
        const emb = part.match(/^(.+?)\s+in\s+(.+)$/i)
        if (emb && looksCompany(emb[1]) && looksPlace(emb[2])) {
          rebuiltNames.push(stripInc(emb[1]))
          rebuiltLocs.push(cleanPlace(emb[2]))
        } else {
          rebuiltNames.push(part.replace(/^the\s+/i, '').trim())
          rebuiltLocs.push(null)
        }
      }
      rebuiltNames.push(stripInc(m[1]))
      rebuiltLocs.push(cleanPlace(m[2]))
      return joinPaired(rebuiltNames, rebuiltLocs)
    }
  }

  // Location field has leaked companies (semicolon lists / "located in")
  if (l && (/\blocated in\b/i.test(l) || /;/.test(l))) {
    const extracted = extractFromLocationBlob(l)
    if (extracted.some(e => e.name)) {
      const names = c ? c.split(/\s*\/\s*/).map(s => s.replace(/^the\s+/i, '').trim()) : []
      const locs = names.map(() => null)

      // Leading place-only → attach to first contractor
      let start = 0
      if (extracted[0]?.name == null && extracted[0]?.location && names.length) {
        locs[0] = extracted[0].location
        start = 1
      } else {
        // Try leading "City, ST;" as primary loc
        const lead = l.match(new RegExp(`^([^;]+?,\\s*(?:[A-Z]{2}|${STATE_NAMES}))`, 'i'))
        if (lead && names.length) locs[0] = cleanPlace(lead[1])
      }

      for (let i = start; i < extracted.length; i++) {
        const e = extracted[i]
        if (!e.name) {
          if (names.length && !locs[0]) locs[0] = e.location
          continue
        }
        const idx = names.findIndex(x => x.toLowerCase() === e.name.toLowerCase())
        if (idx >= 0) {
          if (e.location && !locs[idx]) locs[idx] = e.location
        } else {
          names.push(e.name)
          locs.push(e.location)
        }
      }

      const paired = joinPaired(names, locs.map(cleanPlace))
      c = paired.contractor
      l = paired.contractorLocation || ''
    }
  }

  // Expand + clean slash locations; split pure place "A and B" pairs only
  if (l) {
    const segs = []
    for (const seg of l.split(/\s*\/\s*/)) {
      const placeAndPlace = seg.match(
        new RegExp(
          `^([A-Za-z .'-]+?,\\s*(?:[A-Z]{2}|${STATE_NAMES}))\\s+and\\s+([A-Za-z .'-]+?,\\s*(?:[A-Z]{2}|${STATE_NAMES}))$`,
          'i',
        ),
      )
      if (placeAndPlace) {
        const a = cleanPlace(placeAndPlace[1])
        const b = cleanPlace(placeAndPlace[2])
        if (a) segs.push(a)
        if (b) segs.push(b)
        continue
      }
      // "State, and Company in City" → keep state here; company handled via blob extract
      const stateAndCo = seg.match(
        new RegExp(
          `^((?:${STATE_NAMES})|[A-Za-z .'-]+?,\\s*(?:[A-Z]{2}|${STATE_NAMES}))\\s+and\\s+(.+)$`,
          'i',
        ),
      )
      if (stateAndCo && looksCompany(stateAndCo[2])) {
        const place = cleanPlace(stateAndCo[1])
        if (place) segs.push(place)
        // fold company into contractor
        const co = stateAndCo[2]
        const m = co.match(/^(.+?)\s+in\s+(.+)$/i)
        if (m && looksCompany(m[1])) {
          c = c ? `${c} / ${stripInc(m[1])}` : stripInc(m[1])
          const pl = cleanPlace(m[2])
          // append location for new company
          segs.push(pl || '')
        } else if (looksCompany(co)) {
          c = c ? `${c} / ${stripInc(co)}` : stripInc(co)
          segs.push('')
        }
        continue
      }
      const p = cleanPlace(seg)
      if (p) segs.push(p)
      else if (seg.trim()) segs.push(expandText(seg.trim()))
    }
    l = segs.join(' / ').replace(/(?: \/ )+$/g, '').replace(/^(?: \/ )+/g, '')
  }

  // Do not strip official "The Boeing Company" / similar — only lowercase leftover "the " typos
  if (c) {
    c = c
      .split(/\s*\/\s*/)
      .map(s => s.replace(/^the (?=[a-z])/, '').trim())
      .join(' / ')
  }

  l = l ? expandText(l) : null
  if (l === '') l = null

  if (c === beforeC && l === beforeL) return null
  return { contractor: c || null, contractorLocation: l }
}

const data = JSON.parse(readFileSync(DATA, 'utf8'))
let changed = 0
const samples = []

for (const n of data) {
  const patch = cleanupRow(n)
  if (!patch) continue
  if (patch.contractor === n.contractor && patch.contractorLocation === n.contractorLocation) continue

  if (samples.length < 35) {
    samples.push({
      t: n.transmittal,
      country: n.country,
      before: { c: n.contractor, l: n.contractorLocation },
      after: patch,
    })
  }
  if (!dry) {
    n.contractor = patch.contractor
    n.contractorLocation = patch.contractorLocation
  }
  changed++
}

if (!dry) writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')

console.log(`${dry ? '[DRY] ' : ''}Updated ${changed} rows\n`)
for (const s of samples) {
  console.log(`${s.t} ${s.country}`)
  console.log(`  c: ${s.before.c}`)
  console.log(`  →  ${s.after.contractor}`)
  console.log(`  l: ${s.before.l}`)
  console.log(`  →  ${s.after.contractorLocation}`)
  console.log()
}
