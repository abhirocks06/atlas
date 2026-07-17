#!/usr/bin/env node
/**
 * Conservative heal of contractor / contractorLocation in fms_notifications.json.
 *
 * Safe fixes only:
 *  - Expand state abbrevs (AZ → Arizona, Conn → Connecticut)
 *  - Clear garbage locs (Inc, LLC, Corp)
 *  - OCR "… in St" + loc Louis/St → St. Louis, Missouri
 *  - Split clear "Company in/of City, State" when location empty/abbrev
 *  - Fill known plant city when still blank (major firms)
 *  - Slash-separated multis: heal each segment independently
 *
 * Skips messy "A, and B" OCR clauses.
 *
 * Run: node scripts/heal-contractor-locations.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, '../data/fms_notifications.json')
const dry = process.argv.includes('--dry')

const STATE_EXPAND = {
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
  Conn: 'Connecticut', Mass: 'Massachusetts', Ga: 'Georgia', Fla: 'Florida',
  Calif: 'California', Ill: 'Illinois', Penn: 'Pennsylvania', Pa: 'Pennsylvania',
  Wash: 'Washington', Ore: 'Oregon', Okla: 'Oklahoma', Tenn: 'Tennessee',
  Colo: 'Colorado', Ariz: 'Arizona',
}

const CITY_STATE = {
  tucson: 'Arizona', stratford: 'Connecticut', orlando: 'Florida', mesa: 'Arizona',
  dallas: 'Texas', 'fort worth': 'Texas', 'grand prairie': 'Texas', chicago: 'Illinois',
  seattle: 'Washington', 'st. louis': 'Missouri', 'st louis': 'Missouri', warren: 'Michigan',
  moorestown: 'New Jersey', marietta: 'Georgia', bethesda: 'Maryland',
  andover: 'Massachusetts', tewksbury: 'Massachusetts', mckinney: 'Texas',
  savannah: 'Georgia', wichita: 'Kansas', cincinnati: 'Ohio',
  'east hartford': 'Connecticut', hartford: 'Connecticut', 'auburn hills': 'Michigan',
  'south bend': 'Indiana', 'rolling meadows': 'Illinois', york: 'Pennsylvania',
  'costa mesa': 'California', 'simi valley': 'California', arlington: 'Virginia',
  lynn: 'Massachusetts', owego: 'New York', camden: 'Arkansas', greenville: 'Texas',
  wilmington: 'Massachusetts', 'sterling heights': 'Michigan', phoenix: 'Arizona',
  lubbock: 'Texas', 'ridley park': 'Pennsylvania', 'san diego': 'California',
}

const KNOWN_LOCS = [
  [/lockheed martin aeronautics/i, 'Fort Worth, Texas'],
  [/lockheed martin missile|lockheed martin.*fire control|lockheed martin millimeter/i, 'Orlando, Florida'],
  [/maritime systems and sensors|moorestown/i, 'Moorestown, New Jersey'],
  [/lockheed martin.*marietta/i, 'Marietta, Georgia'],
  [/sikorsky/i, 'Stratford, Connecticut'],
  [/raytheon missile|raytheon.*tucson|electronic and missile systems.*tucson|(excalibur).*tucson/i, 'Tucson, Arizona'],
  [/raytheon.*andover/i, 'Andover, Massachusetts'],
  [/raytheon.*tewksbury/i, 'Tewksbury, Massachusetts'],
  [/raytheon.*mckinney|network centric/i, 'McKinney, Texas'],
  [/general atomics/i, 'San Diego, California'],
  [/am general/i, 'South Bend, Indiana'],
  [/bell helicopter|bell textron|bell flight/i, 'Fort Worth, Texas'],
  [/hawker beechcraft|beechcraft/i, 'Wichita, Kansas'],
  [/general electric.*(cincinnati|aviation)|ge aerospace|ge aviation/i, 'Cincinnati, Ohio'],
  [/pratt\s*(?:&|and)\s*whitney/i, 'East Hartford, Connecticut'],
  [/gulfstream/i, 'Savannah, Georgia'],
  [/northrop.*rolling meadows/i, 'Rolling Meadows, Illinois'],
  [/bae systems.*\byork\b|\bin york\b/i, 'York, Pennsylvania'],
  [/anduril/i, 'Costa Mesa, California'],
  [/aerovironment|aero\s*vironment/i, 'Simi Valley, California'],
  [/longbow/i, 'Orlando, Florida'],
]

const GARBAGE_LOC = /^(Inc|LLC|Corp|Ltd|Co|the|and|St)\.?$/i
const MESSY_AND = /,\s*and\s+|\band\s+(?:[A-Z][A-Za-z .,&'-]{0,80}\s+)?(?:Inc|LLC|Corp|Company|Systems|International|Division|Manufacturing|Group|Industries|Business|Motors)\b/i
const INVENTORY = /(?:army|navy|marine|air force|government)\s+(?:stock|inventory)/i

function expandStateToken(tok) {
  if (!tok) return null
  const t = tok.trim().replace(/\.$/, '')
  return STATE_EXPAND[t] || STATE_EXPAND[t.toUpperCase()] || null
}

function isBareStateName(s) {
  if (!s) return false
  const t = s.trim().toLowerCase()
  return Object.values(STATE_EXPAND).some(v => v.toLowerCase() === t)
}

function expandLocAbbrevs(loc) {
  if (!loc) return null
  let s = loc.trim().replace(/^and\s+/i, '').replace(/\s+/g, ' ')
  if (GARBAGE_LOC.test(s)) return null

  const bare = expandStateToken(s)
  if (bare) return bare

  s = s.replace(/,\s*([A-Za-z]{2})$/i, (_, ab) => {
    const full = expandStateToken(ab)
    return full ? `, ${full}` : `, ${ab}`
  })
  s = s.replace(/\s+([A-Z]{2})$/g, (_, ab) => {
    const full = expandStateToken(ab)
    return full ? `, ${full}` : ` ${ab}`
  })
  s = s.replace(/\b(Conn|Mass|Ga|Fla|Calif|Ill|Penn|Pa|Wash|Ore|Okla|Tenn|Colo|Ariz)\b/gi, (m) => {
    const k = Object.keys(STATE_EXPAND).find(x => x.toLowerCase() === m.toLowerCase())
    return k ? STATE_EXPAND[k] : m
  })

  const cityKey = s.toLowerCase().replace(/\./g, '')
  if (CITY_STATE[cityKey] && !/,/.test(s)) {
    const city = s.replace(/\bSt\b/i, 'St.')
    return `${city}, ${CITY_STATE[cityKey]}`
  }
  return s
}

function knownLoc(name) {
  for (const [re, loc] of KNOWN_LOCS) {
    if (re.test(name)) return loc
  }
  if (/boeing/i.test(name) && /\bSt\.?\b/i.test(name)) return 'St. Louis, Missouri'
  if (/boeing.*mesa/i.test(name)) return 'Mesa, Arizona'
  if (/boeing.*chicago|of chicago/i.test(name)) return 'Chicago, Illinois'
  if (/boeing.*seattle|integrated defense systems in seattle/i.test(name)) return 'Seattle, Washington'
  return null
}

function isCleanPlace(place) {
  if (!place || place.length < 2) return false
  if (MESSY_AND.test(place)) return false
  if (/\b(Inc|LLC|Corp|Company|Systems|International|Division|Manufacturing|Group)\b/i.test(place) && !/,\s*(Inc|LLC)\b/i.test(place)) {
    // "Phoenix, AZ" ok; "Alcoa Business in Whitehall" not a place-only
    if (/\b(Business|Enterprise|Industries|Technologies)\b/i.test(place)) return false
  }
  return (
    /,/.test(place) ||
    Boolean(expandStateToken(place)) ||
    Object.keys(CITY_STATE).some(c => new RegExp(`\\b${c.replace(/\./g, '\\.')}\\b`, 'i').test(place)) ||
    /\b(California|Arizona|Florida|Texas|Virginia|Massachusetts|Connecticut|Alabama|Maryland|Pennsylvania|Illinois|Georgia|Ohio|Indiana|Washington|Missouri|New York|New Jersey|Colorado|Oklahoma|Arkansas|North Carolina|Michigan|Belgium)\b/i.test(place)
  )
}

/** Split only clean "Name in/of Place" forms. */
function splitEmbedded(raw) {
  if (MESSY_AND.test(raw)) return null
  const m = raw.match(/^(.+?)\s+(?:located\s+)?(?:in|of)\s+(.+)$/i)
  if (!m) return null
  const place = m[2].trim()
  if (/^St\.?$/i.test(place)) return { name: m[1].trim(), location: 'St. Louis, Missouri' }
  if (!isCleanPlace(place)) return null
  return { name: m[1].trim(), location: expandLocAbbrevs(place) }
}

function healSegment(name, loc) {
  let n = name.trim()
  let l = loc ? String(loc).trim() : null
  if (l && GARBAGE_LOC.test(l)) l = null

  // Skip messy multi-company segments
  if (MESSY_AND.test(n)) return { name: n, location: l ? expandLocAbbrevs(l) : l, skipped: true }

  // OCR St. Louis
  if (/(?:in|of)\s+St\.?\s*$/i.test(n) && (!l || /^(St\.?|Louis|Louis,.+)$/i.test(l))) {
    n = n.replace(/\s+(?:in|of)\s+St\.?\s*$/i, '').trim()
    l = 'St. Louis, Missouri'
    return { name: n, location: l }
  }

  // "Company in City" + loc "State" / "StateAbbrev"
  if (l && (expandStateToken(l) || isBareStateName(l))) {
    const emb = n.match(/^(.+?)\s+(?:in|of)\s+([A-Za-z .'-]+)$/i)
    if (emb && isCleanPlace(emb[2]) && !/,/.test(emb[2])) {
      const state = expandStateToken(l) || l
      return { name: emb[1].trim(), location: `${emb[2].trim()}, ${state}` }
    }
  }

  const emb = splitEmbedded(n)
  if (emb) {
    n = emb.name
    if (!l) {
      l = emb.location
    } else if (expandStateToken(l) || isBareStateName(l)) {
      const city = emb.location.split(',')[0].trim()
      l = `${city}, ${expandStateToken(l) || l}`
    } else {
      const expanded = expandLocAbbrevs(l)
      // Prefer richer city,state from embedded split over bare/weak loc
      l = (emb.location && emb.location.length > (expanded || '').length) ? emb.location : (expanded || emb.location)
    }
  } else if (l) {
    l = expandLocAbbrevs(l)
  }

  // City glued without "in": "Raytheon … Tucson"
  if (!l) {
    const cityGlue = n.match(/\b(Tucson|Moorestown|Stratford|Orlando|Mesa)\s*$/i)
    if (cityGlue) {
      const city = cityGlue[1]
      const state = CITY_STATE[city.toLowerCase()]
      if (state) l = `${city}, ${state}`
    }
  }

  if (!l) l = knownLoc(n)
  return { name: n.replace(/[,\s]+$/g, '').trim(), location: l }
}

function healRecord(rec) {
  const contractor = rec.contractor
  if (!contractor) return null
  if (INVENTORY.test(contractor)) {
    if (rec.contractorLocation && GARBAGE_LOC.test(String(rec.contractorLocation).trim())) {
      return { contractor, contractorLocation: null }
    }
    return null
  }

  // Entire record messy with ", and " — only expand abbrevs / clear garbage on location
  if (MESSY_AND.test(contractor) || (rec.contractorLocation && MESSY_AND.test(rec.contractorLocation))) {
    if (!rec.contractorLocation) {
      // try known loc only if single firm-ish
      if (!MESSY_AND.test(contractor)) {
        const k = knownLoc(contractor)
        if (k) return { contractor, contractorLocation: k }
      }
      return null
    }
    if (GARBAGE_LOC.test(String(rec.contractorLocation).trim())) {
      return { contractor, contractorLocation: null }
    }
    // Don't rewrite messy and-clauses
    const onlyExpand = expandLocAbbrevs(rec.contractorLocation)
    if (onlyExpand && onlyExpand !== rec.contractorLocation && !MESSY_AND.test(rec.contractorLocation)) {
      return { contractor, contractorLocation: onlyExpand }
    }
    return null
  }

  const names = contractor.split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
  const locs = rec.contractorLocation
    ? String(rec.contractorLocation).split(/\s*\/\s*/).map(s => s.trim())
    : []

  const outNames = []
  const outLocs = []
  let skipped = false
  for (let i = 0; i < names.length; i++) {
    const { name, location, skipped: sk } = healSegment(names[i], locs[i] || (names.length === 1 ? rec.contractorLocation : null))
    outNames.push(name)
    outLocs.push(location || null)
    if (sk) skipped = true
  }

  if (skipped && names.length > 1) return null

  const nextC = outNames.join(' / ')
  let nextL = null
  if (outLocs.every(Boolean) && outLocs.length === outNames.length) {
    nextL = outLocs.join(' / ')
  } else if (outNames.length === 1) {
    nextL = outLocs[0] || null
  } else if (rec.contractorLocation) {
    // keep original multi loc if we couldn't align; maybe just expand abbrevs
    nextL = String(rec.contractorLocation)
      .split(/\s*\/\s*/)
      .map(p => expandLocAbbrevs(p) || p)
      .join(' / ')
  }

  if (nextC === contractor && nextL === rec.contractorLocation) return null
  if (nextC === contractor && !nextL && rec.contractorLocation && !GARBAGE_LOC.test(String(rec.contractorLocation).trim())) {
    return null
  }
  return { contractor: nextC, contractorLocation: nextL }
}

const data = JSON.parse(readFileSync(DATA, 'utf8'))
const beforeMiss = data.filter(r => r.contractor && !r.contractorLocation).length
let changed = 0
const samples = []

for (const n of data) {
  const patch = healRecord(n)
  if (!patch) continue
  changed++
  if (samples.length < 30) {
    samples.push({ t: n.transmittal, before: { c: n.contractor, l: n.contractorLocation }, after: patch })
  }
  if (!dry) {
    n.contractor = patch.contractor
    n.contractorLocation = patch.contractorLocation
  }
}

console.log(`${dry ? 'DRY ' : ''}Updating ${changed} records`)
for (const s of samples) {
  console.log(`  ${s.t || '—'}`)
  console.log(`    before: ${s.before.c} | ${s.before.l}`)
  console.log(`    after:  ${s.after.contractor} | ${s.after.contractorLocation}`)
}

if (!dry) {
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')
  const miss = data.filter(r => r.contractor && !r.contractorLocation).length
  const has = data.filter(r => r.contractor && r.contractorLocation).length
  const garbage = data.filter(r => r.contractorLocation && GARBAGE_LOC.test(String(r.contractorLocation).trim())).length
  console.log(`\nWrote ${DATA}`)
  console.log(`contractor+location: ${has}`)
  console.log(`contractor+no location: ${miss} (was ${beforeMiss})`)
  console.log(`garbage locs remaining: ${garbage}`)
}
