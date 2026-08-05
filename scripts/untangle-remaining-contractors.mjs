/**
 * Untangle remaining messy contractor/location rows using patterns learned
 * from DSCA notices, then PDF-reparse anything still broken.
 *
 * Run: node scripts/untangle-remaining-contractors.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { extractContractors } from './extract-contractors.mjs'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')

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
const PLACE = `(?:[A-Z][a-zA-Z.'-]+(?:[\\s-][A-Z][a-zA-Z.']+){0,3},\\s*(?:[A-Z]{2}|${STATE_NAMES})|[A-Z]{2})`

function expand(s) {
  if (!s) return s
  let out = String(s)
    .replace(/\bSt Louis\b/g, 'St. Louis')
    .replace(/\bFt\.?\s*Worth\b/gi, 'Fort Worth')
    .replace(/\bFt\.?\s*Wayne\b/gi, 'Fort Wayne')
  out = out.replace(/,\s*([A-Z]{2})\.?/g, (_, ab) => (STATE[ab] ? `, ${STATE[ab]}` : `, ${ab}`))
  out = out.replace(/\b([A-Z]{2})\.?$/g, (m, ab) => (STATE[ab] ? STATE[ab] : m))
  return out.replace(/\s+/g, ' ').trim()
}

function cleanPlace(p) {
  if (!p) return null
  let s = expand(String(p).replace(/^and\s+/i, '').replace(/[;,]\s*$/, '').trim())
  if (/^(Inc|LLC|Corp|Ltd|FL|the)$/i.test(s)) return null
  // bare FL → Florida is useless alone
  if (/^(Florida|Arizona|Texas|California|Massachusetts|Michigan|Alabama)$/i.test(s) && s.length < 15) {
    // keep if that's all we have
  }
  return s || null
}

function stripInc(n) {
  return n
    .replace(/^the\s+/i, '')
    .replace(/^a\s+/i, '')
    .replace(/,?\s*Inc\.?$/i, '')
    .replace(/,?\s*LLC\.?$/i, '')
    .trim()
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

/** Parse repeated "Company in/of Place" lists (comma / and separated). */
function parseInOfList(text) {
  const entries = []
  // Normalize
  let t = text
    .replace(/\s+/g, ' ')
    .replace(/\band\s+/gi, ', ')
    .trim()

  // "Company in Place" or "Company of Place" — Place is City, State or abbrev
  const re = new RegExp(
    `([A-Z][^,]{2,80}?)\\s+(?:in|of)\\s+(${PLACE})(?=,|$)`,
    'gi',
  )
  let m
  while ((m = re.exec(t)) !== null) {
    const name = stripInc(m[1].replace(/^,\s*/, ''))
    const loc = cleanPlace(m[2])
    if (name.length >= 3 && loc) entries.push({ name, location: loc })
  }
  return entries
}

/** "Company, City, State, and Company, City, State" / "Company, City, State and Company" */
function parseCommaCityList(text) {
  const entries = []
  let t = text.replace(/\s+/g, ' ').trim()

  // Split on ", and " / " and " before capital company
  const chunks = t.split(/\s*,\s*and\s+(?=[A-Z])|\s+and\s+(?=[A-Z][a-zA-Z]+(?:\s+[A-Z])*)/)
  for (let chunk of chunks) {
    chunk = chunk.replace(/^,\s*/, '').trim()
    // Company, City, State
    let m = chunk.match(new RegExp(`^(.+?),\\s*(${PLACE})$`, 'i'))
    if (m) {
      entries.push({ name: stripInc(m[1]), location: cleanPlace(m[2]) })
      continue
    }
    // Company only
    if (/[A-Za-z]{3,}/.test(chunk) && !/^(Florida|Arizona|Massachusetts)$/i.test(chunk)) {
      entries.push({ name: stripInc(chunk), location: null })
    }
  }
  return entries
}

function isJavelinMess(c, l) {
  return /javelin/i.test(c + ' ' + (l || '')) && (/FL\b|\bOrlando\b|Raytheon|Lockheed|RTX|joint venture/i.test(c + ' ' + (l || '')))
}

function fixJavelin(c, l) {
  // Standard JJV plants: Raytheon/RTX Tucson + Lockheed Orlando
  const hasRtx = /RTX|Raytheon/i.test(c + ' ' + (l || ''))
  return {
    contractor: hasRtx && /RTX/i.test(c + l) && !/Raytheon/i.test(c)
      ? 'RTX Corporation / Lockheed Martin'
      : 'Raytheon / Lockheed Martin',
    contractorLocation: 'Tucson, Arizona / Orlando, Florida',
  }
}

function looksMessy(c, l) {
  if (!c) return false
  const blob = c + ' | ' + (l || '')
  if (/\bin Ft\.?$/i.test(c)) return true
  if (/\bFL\b/.test(l || '') && /javelin|Raytheon|Lockheed/i.test(blob)) return true
  if (/,\s*and\s+[A-Z]/.test(c) || /\bin\s+[A-Z].*,\s*[A-Z].*\bin\s+/i.test(c)) return true
  if (/\bof\s+[A-Z][a-z]+/.test(c) && /,\s*and\s+/i.test(l || '')) return true
  if (/^[A-Z].+\bin\s+.+,/.test(c) && /,/.test(c)) return true
  if (l && /^[A-Z].+\bin\s+/.test(l.split('/')[0].trim()) && looksCompanyName(l.split('/')[0])) return true
  if (/LLC of /i.test(l || '')) return true
  if (/,\s*[A-Z][a-zA-Z .]+,\s*(Florida|Arizona|Texas|Maryland|Pennsylvania|Connecticut|Massachusetts|Virginia|Ohio|California)/i.test(c) && /and /i.test(c)) return true
  if (/Alexandria,.+and Johnstown/i.test(l || '')) return true
  if (/Honeywell,\s*Clearwater/i.test(c)) return true
  if (/Lockheed Martin,\s*Bethesda/i.test(c)) return true
  if (/Corporation,\s*[A-Z].+,\s*and\s+Lockheed/i.test(c)) return true
  if (/Company,\s*Fort Worth.+and Pratt/i.test(c)) return true
  if (/Joint Venture,\s*Orlando/i.test(c)) return true
  if (/Florida,\s*and Raytheon/i.test(l || '')) return true
  if (/Massachusetts,\s*and McAlester/i.test(l || '')) return true
  if (/Arizona,\s*and McKinney/i.test(l || '')) return true
  return false
}

function looksCompanyName(s) {
  return /\b(Inc|LLC|Corp|Company|Corporation|Systems|Martin|Boeing|Raytheon|RTX|Lockheed|Northrop|Harris|ITT|BAE|General|Electric|Pratt|Whitney|Thales|Smith|Orbital|Flight|Honeywell|Allison|Cummins|Leonardo|Renk|Daimler|McAlester|United Technologies|Robertson|Marvin|Goodrich|Exelis|Cubic|Booz|Kratos|Valiant|Sabena|Sierra|V2X|Leidos|KBR|Sigmatech|Willard|Insitu|Rolls)\b/i.test(
    s,
  )
}

function untangle(c0, l0) {
  let c = (c0 || '').trim()
  let l = (l0 || '').trim()
  if (!c) return null

  if (isJavelinMess(c, l)) return fixJavelin(c, l)

  // Truncated Ft Worth
  if (/\bin Ft\.?$/i.test(c) && /Fort Worth/i.test(l)) {
    return { contractor: c.replace(/\s+in Ft\.?$/i, '').trim(), contractorLocation: 'Fort Worth, Texas' }
  }

  // Split "Alexandria, Virginia, and Johnstown, Pennsylvania"
  if (/,\s*and\s+/i.test(l) && !looksCompanyName(l)) {
    l = l
      .split(/\s*\/\s*/)
      .flatMap(seg => {
        if (/,\s*and\s+/i.test(seg) && !looksCompanyName(seg)) {
          return seg.split(/\s*,\s*and\s+/i).map(cleanPlace).filter(Boolean)
        }
        return [seg]
      })
      .join(' / ')
  }

  // Honeywell, Clearwater, FL embedded in slash list
  if (/Honeywell,\s*Clearwater,\s*FL/i.test(c)) {
    const names = c.split(/\s*\/\s*/).map(s => s.trim())
    const locs = (l ? l.split(/\s*\/\s*/) : []).map(s => s.trim())
    const outN = []
    const outL = []
    let locIdx = 0
    for (const name of names) {
      const m = name.match(/^Honeywell,\s*(Clearwater),\s*(FL|Florida)$/i)
      if (m) {
        outN.push('Honeywell')
        outL.push(cleanPlace(`${m[1]}, Florida`))
      } else {
        outN.push(name)
        outL.push(locs[locIdx] || null)
        locIdx++
      }
    }
    // If we inserted an extra loc, remaining locs may be short — pad from leftover
    while (locIdx < locs.length) {
      // append unused? usually Honeywell stole a slot so counts align better
      break
    }
    return joinPaired(outN, outL.map(cleanPlace))
  }

  // Lockheed Martin, Bethesda, Maryland as second slash segment
  if (/\/\s*Lockheed Martin,\s*([^/]+)$/i.test(c) && l && !l.includes('/')) {
    const m = c.match(/^(.*?)\s*\/\s*Lockheed Martin,\s*(.+)$/i)
    if (m) {
      return joinPaired(
        [stripInc(m[1]), 'Lockheed Martin'],
        [cleanPlace(l), cleanPlace(m[2])],
      )
    }
  }

  // "Company, City, State, and Company" + location for second company
  if (/,\s*[A-Z].+,\s*(?:[A-Z]{2}|Florida|Arizona|Texas|Massachusetts|Pennsylvania|Connecticut|Maryland|Virginia|Ohio|California|Georgia|Missouri).*\band\s+/i.test(c)) {
    const entries = parseCommaCityList(c)
    if (entries.length >= 2) {
      // If last has no loc and l is a place, assign
      if (!entries[entries.length - 1].location && l && !looksCompanyName(l)) {
        entries[entries.length - 1].location = cleanPlace(l)
      }
      // If first missing loc and we have only one loc for last, ok
      return joinPaired(
        entries.map(e => e.name),
        entries.map(e => e.location),
      )
    }
  }

  // "Company in A, Company in B, and Company in C" (optionally + Tempe for Robertson)
  if (/\bin\s+[^,]+,.+\bin\s+/i.test(c)) {
    const entries = parseInOfList(c)
    if (entries.length >= 2) {
      // leftover LLC name without "in"
      const leftover = c.replace(/\band\s+/gi, ', ')
      const lastBit = leftover.split(',').pop()?.trim()
      if (lastBit && /LLC|Inc|Company|Corporation|Systems/i.test(lastBit) && !/\b(?:in|of)\b/i.test(lastBit)) {
        entries.push({ name: stripInc(lastBit), location: cleanPlace(l) })
      } else if (l && entries.every(e => e.location) && !entries.some(e => /Robertson/i.test(e.name))) {
        // Tempe for Robertson already handled if in list
      }
      return joinPaired(
        entries.map(e => e.name),
        entries.map(e => e.location),
      )
    }
  }

  // "Company of City" + "State, and Company of City"
  if (/\bof\s+[A-Z]/.test(c) && /,\s*and\s+/i.test(l || '')) {
    const combined = `${c}, ${l}`.replace(/\s+/g, ' ')
    // Fix "of Waltham | Massachusetts" → of Waltham, Massachusetts
    const fixed = combined
      .replace(/\bof\s+(Waltham),\s*Massachusetts/i, 'of Waltham, Massachusetts')
      .replace(/\bof\s+(Tucson),\s*Arizona/i, 'of Tucson, Arizona')
      .replace(/\bin\s+(Orlando),\s*Florida/i, 'in Orlando, Florida')
    const entries = parseInOfList(fixed.replace(/\band\s+/gi, ', '))
    // Also try: Thales Raytheon Systems Company LLC of Fullerton
    if (/LLC of /i.test(l) && /Thales|Raytheon|Boeing/i.test(c)) {
      const full = `${c} LLC of Fullerton, California`.replace(/Company\s+LLC/i, 'Company LLC')
      // 09-55 special reconstruct
      const e2 = parseInOfList(
        'Boeing Aerospace Company of Huntsville, AL, Raytheon Missile Systems of Tucson, AZ, Thales Raytheon Systems Company LLC of Fullerton, California'.replace(
          /\band\s+/gi,
          ', ',
        ),
      )
      if (e2.length >= 2) {
        return joinPaired(
          e2.map(e => e.name.replace(/\s+LLC$/i, ' LLC')),
          e2.map(e => e.location),
        )
      }
    }
    if (entries.length >= 2) {
      return joinPaired(
        entries.map(e => e.name),
        entries.map(e => e.location),
      )
    }
  }

  // Location starts with company in place (ITT leaked)
  if (l && looksCompanyName(l.split('/')[0]) && /\bin\s+/.test(l.split('/')[0])) {
    const segs = l.split(/\s*\/\s*/)
    const names = c.split(/\s*\/\s*/).map(s => s.trim())
    const locs = []
    const newNames = [...names]
    for (let i = 0; i < segs.length; i++) {
      const m = segs[i].match(/^(.+?)\s+in\s+(.+)$/i)
      if (m && looksCompanyName(m[1])) {
        newNames.splice(i, 0, stripInc(m[1]))
        locs.push(cleanPlace(m[2]))
      } else {
        locs.push(cleanPlace(segs[i]))
      }
    }
    // Deduplicate if we over-inserted
    return joinPaired(newNames, locs)
  }

  // "of Tucson" + "Arizona, and McKinney, Texas"
  if (/\bof\s+Tucson$/i.test(c) && /Arizona,\s*and\s+McKinney/i.test(l)) {
    return {
      contractor: c.replace(/\s+of\s+Tucson$/i, '') + ' / Raytheon',
      contractorLocation: 'Tucson, Arizona / McKinney, Texas',
    }
  }
  // Better: RMS Tucson + McKinney (often same company two sites, or Raytheon both)
  if (/Raytheon Missile Systems.*Tucson/i.test(c) && /Arizona,\s*and\s+McKinney/i.test(l)) {
    return {
      contractor: 'Raytheon Missile Systems / Raytheon',
      contractorLocation: 'Tucson, Arizona / McKinney, Texas',
    }
  }

  // "of Waltham" + "Massachusetts, and McAlester..."
  if (/\bof\s+Waltham$/i.test(c) && /Massachusetts,\s*and\s+/i.test(l)) {
    const m = l.match(/Massachusetts,\s*and\s+(.+?)\s+of\s+(.+)$/i)
    if (m) {
      return joinPaired(
        [stripInc(c.replace(/\s+of\s+Waltham$/i, '')), stripInc(m[1])],
        ['Waltham, Massachusetts', cleanPlace(m[2])],
      )
    }
  }

  // Javelin "Florida, and Raytheon in Tucson"
  if (/Lockheed.*Orlando/i.test(c) && /Florida,\s*and\s+Raytheon\s+in\s+Tucson/i.test(l)) {
    return {
      contractor: 'Lockheed Martin / Raytheon',
      contractorLocation: 'Orlando, Florida / Tucson, Arizona',
    }
  }

  // BAE Systems, York, Pennsylvania + Anniston → production vs plant; keep both as York primary? 
  // Notice often: BAE York for AAV, work at Anniston. Prefer York as contractor loc, Anniston as second note.
  // Or: BAE Systems / Anniston Army Depot style. Keep BAE at York; Anniston as second location only if two firms.
  if (/^BAE Systems,\s*York,\s*Pennsylvania$/i.test(c) && /Anniston/i.test(l)) {
    return {
      contractor: 'BAE Systems',
      contractorLocation: 'York, Pennsylvania',
      // Anniston is often government depot — drop from loc or append
      _alt: 'York, Pennsylvania / Anniston, Alabama',
    }
  }

  return null
}

function normalizePdfText(rawText) {
  let text = rawText
  const txMarker = 'Transmittal No'
  const firstTx = rawText.indexOf(txMarker)
  if (firstTx >= 0) {
    const secondTx = rawText.indexOf(txMarker, firstTx + 20)
    if (secondTx > firstTx + 20) text = rawText.slice(0, secondTx)
  }
  return text.replace(/\r/g, '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()
}

async function fromPdf(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const parsed = await pdfParse(buffer)
  return extractContractors(normalizePdfText(parsed.text))
}

function stillMessy(c, l) {
  return looksMessy(c, l) || isJavelinMess(c, l)
}

const TARGETS = [
  '09-55','09-72','11-45','12-30','13-29','13-60','16-01','16-24','16-31','16-39',
  '16-66','17-66','19-04','19-37','20-06','20-43','23-11','23-17','23-22','23-56',
  '23-83','21-68','22-02','09-35','14-21','15-35','19-58','20-56','24-10','24-25',
  '24-90','25-16','25-32','25-57','25-75',
]

const data = JSON.parse(readFileSync(DATA, 'utf8'))
const changes = []

// Pass 1: local untangle
for (const n of data) {
  if (!TARGETS.includes(n.transmittal)) continue
  let patch = untangle(n.contractor, n.contractorLocation)

  // 19-04: keep York (BAE plant); Anniston is often depot — use York
  if (n.transmittal === '19-04' && patch?._alt) {
    patch = { contractor: 'BAE Systems', contractorLocation: 'York, Pennsylvania' }
  }
  if (patch?._alt) delete patch._alt

  // 16-66 alexandria/johnstown
  if (n.transmittal === '16-66' && /Alexandria,.+and Johnstown/i.test(n.contractorLocation || '')) {
    const locs = n.contractorLocation.split(/\s*\/\s*/).flatMap(seg => {
      if (/Alexandria,.+and Johnstown/i.test(seg)) {
        return ['Alexandria, Virginia', 'Johnstown, Pennsylvania']
      }
      return [seg]
    })
    // Now 12 locs vs 11 companies — Johnstown is JSMC second site; merge into JSMC slot
    // Companies: GD, JSMC, Kongsberg, Raytheon, Meggitt, Palomar, NG, DRS, LM, Honeywell, Miltope (11)
    // Original had Alexandria and Johnstown for JSMC — use Alexandria only or "Alexandria, Virginia / Johnstown, Pennsylvania" in one slot
    const names = n.contractor.split(/\s*\/\s*/)
    const fixedLocs = n.contractorLocation.split(/\s*\/\s*/).map(seg => {
      if (/Alexandria,.+and Johnstown/i.test(seg)) {
        return 'Alexandria, Virginia; Johnstown, Pennsylvania'
      }
      return expand(seg)
    })
    patch = joinPaired(names, fixedLocs)
  }

  if (patch && (patch.contractor !== n.contractor || patch.contractorLocation !== n.contractorLocation)) {
    changes.push({
      t: n.transmittal,
      country: n.country,
      method: 'untangle',
      before: { c: n.contractor, l: n.contractorLocation },
      after: patch,
    })
    if (!dry) {
      n.contractor = patch.contractor
      n.contractorLocation = patch.contractorLocation
    }
  }
}

// Pass 2: PDF reparse for still-messy or count-mismatch targets
const needPdf = data.filter(n => {
  if (!TARGETS.includes(n.transmittal)) return false
  if (!/media\.defense\.gov|\.pdf/i.test(n.sourceUrl || '')) return false
  const c = dry
    ? (changes.find(x => x.t === n.transmittal)?.after.contractor ?? n.contractor)
    : n.contractor
  const l = dry
    ? (changes.find(x => x.t === n.transmittal)?.after.contractorLocation ?? n.contractorLocation)
    : n.contractorLocation
  if (stillMessy(c, l)) return true
  const nc = (c || '').split(/\s*\/\s*/).filter(Boolean).length
  const nl = (l || '').split(/\s*\/\s*/).filter(Boolean).length
  return nc > 1 && nl > 0 && Math.abs(nc - nl) > 0
})

console.log(`Untangle changes: ${changes.length}`)
console.log(`PDF reparse candidates: ${needPdf.length}`)

for (let i = 0; i < needPdf.length; i++) {
  const n = needPdf[i]
  process.stdout.write(`\rPDF ${i + 1}/${needPdf.length} ${n.transmittal}   `)
  try {
    const parsed = await fromPdf(n.sourceUrl)
    if (!parsed?.contractor) continue
    // Prefer PDF when it has locations and current is messy/mismatched
    const cur = changes.find(x => x.t === n.transmittal)
    const curC = cur?.after.contractor ?? n.contractor
    const curL = cur?.after.contractorLocation ?? n.contractorLocation
    const pdfBetter =
      parsed.contractorLocation &&
      (stillMessy(curC, curL) ||
        ((curC || '').split('/').length !== (curL || '').split('/').length &&
          parsed.contractor.split('/').length === (parsed.contractorLocation || '').split('/').length))

    // Don't take obvious garbage PDF parses
    if (/production is|missile is|LV MK4/i.test(parsed.contractor)) continue

    if (pdfBetter || (stillMessy(curC, curL) && parsed.contractorLocation)) {
      // Soft merge: if untangle already fixed javelin etc, skip overwrite unless pdf aligns count
      if (cur?.method === 'untangle' && !stillMessy(cur.after.contractor, cur.after.contractorLocation)) {
        continue
      }
      const after = {
        contractor: parsed.contractor,
        contractorLocation: parsed.contractorLocation
          ? parsed.contractorLocation
              .split(/\s*\/\s*/)
              .map(expand)
              .join(' / ')
          : null,
      }
      const idx = changes.findIndex(x => x.t === n.transmittal)
      const entry = {
        t: n.transmittal,
        country: n.country,
        method: 'pdf',
        before: { c: n.contractor, l: n.contractorLocation },
        after,
      }
      if (idx >= 0) changes[idx] = entry
      else changes.push(entry)
      if (!dry) {
        n.contractor = after.contractor
        n.contractorLocation = after.contractorLocation
      }
    }
  } catch (e) {
    console.log(`\n  ${n.transmittal} PDF error: ${e.message}`)
  }
  await new Promise(r => setTimeout(r, 200))
}

if (!dry) writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n')

console.log(`\n\nTotal updates: ${changes.length}`)
for (const ch of changes) {
  console.log(`\n${ch.t} ${ch.country} [${ch.method}]`)
  console.log(`  c: ${ch.before.c}`)
  console.log(`  →  ${ch.after.contractor}`)
  console.log(`  l: ${ch.before.l}`)
  console.log(`  →  ${ch.after.contractorLocation}`)
}

// Report still messy
const still = []
for (const n of data) {
  if (!TARGETS.includes(n.transmittal)) continue
  const c = dry ? (changes.find(x => x.t === n.transmittal)?.after.contractor ?? n.contractor) : n.contractor
  const l = dry ? (changes.find(x => x.t === n.transmittal)?.after.contractorLocation ?? n.contractorLocation) : n.contractorLocation
  if (stillMessy(c, l)) still.push({ t: n.transmittal, c, l })
}
console.log(`\nStill messy after pass: ${still.length}`)
for (const s of still) {
  console.log(`  ${s.t}: ${s.c} || ${s.l}`)
}
