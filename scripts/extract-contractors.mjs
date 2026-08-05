/** Shared DSCA press-release contractor extraction. */

const TBD_CLAUSE =
  /\b(determined|identified|negotiated|selected|award|various|no prime|approved vendors|defined in negotiations|provided by|not known|unknown at this time|new contractor competition|not associated with|chosen after|competitive source selection|will be chosen)\b/i

const JUNK_NAME =
  /\b(adverse impact|defense readiness|offset agreement|negotiations between|purchaser and the contractor|provided by u|not yet been|have not been|to be selected|to be determined|not known|competitive award|open competition|approved vendors|various contractors|no prime|original equipment manufacturer|this sale will be part|not associated with|involved in|involved with|associated with|proposed sale)\b/i

const US_STATES =
  'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming'

const STATE_OR_ABBR = `(?:[A-Z]{2}|${US_STATES})`

// Longer phrases first so "Aircraft Engines" wins over "Aircraft"
const COMPANY_SUFFIX =
  '(?:Aircraft Engines|Millimeter Technology|Limited Liability Corporation|Company|Corporation|Corp|Inc|LLC|Aircraft|Systems|System|Engines|Helicopters|Helicopter|Technologies|Technology|International|Industries|Electronics|Communications|Missiles|Aeronautics|Defense)'

function looksLikeCompany(name) {
  const n = name.trim()
  if (n.length < 3 || n.length > 120) return false
  if (JUNK_NAME.test(n)) return false
  if (!/[A-Za-z]/.test(n)) return false
  if (/^(no |there |implementation |any |this |the purchaser|offsets?|and |involved |associated |proposed |requirement |listed |integrator |sale )/i.test(n)) return false
  const words = n.split(/\s+/).filter(Boolean)
  if (words.length < 2 && !/Inc|LLC|Corp/i.test(n)) {
    // Allow single-token primes: BAE, Leidos, Boeing, Raytheon
    if (!/^[A-Z][A-Za-z0-9&.'-]{2,}$/.test(n.replace(/,$/, ''))) return false
  }
  // Reject glued "MD Helicopters Mesa Arizona General Electric Company" parses
  if (new RegExp(`\\b(?:${US_STATES})\\b`, 'i').test(n)) return false
  return true
}

function looksLikeLocation(loc) {
  if (!loc || loc.length > 100) return false
  if (/\b(Company|Corporation|Engines|Aircraft|Systems)\b/i.test(loc)) return false
  return true
}

function protectAbbrevs(text) {
  return text
    .replace(/\bU\.S\./g, 'US')
    .replace(/\bD\.C\./g, 'DC')
    .replace(/\bSt\.\s*Louis\b/gi, 'St Louis')
    .replace(/\bFt\./g, 'Ft')
    .replace(/\bMt\./g, 'Mt')
    .replace(/\bInc\./g, 'Inc')
    .replace(/\bLtd\./g, 'Ltd')
    .replace(/\bCorp\./g, 'Corp')
    .replace(/\bCo\./g, 'Co')
    .replace(/\bMo\./g, 'Missouri')
    .replace(/\bMass\./g, 'Massachusetts')
    .replace(/\bCalif\./g, 'California')
    .replace(/\bMd\./g, 'Maryland')
    .replace(/\bPa\./g, 'Pennsylvania')
    .replace(/\bVa\./g, 'Virginia')
    .replace(/\bFla\./g, 'Florida')
    .replace(/\bIll\./g, 'Illinois')
    .replace(/\bConn\./g, 'Connecticut')
    .replace(/\bColo\./g, 'Colorado')
    .replace(/\bAriz\./g, 'Arizona')
}

/**
 * "The Boeing Company Mesa, Arizona Lockheed Martin Corporation Orlando, Florida"
 * City is 1–4 capitalized words so a missing comma can't swallow the next company.
 */
function parseCityStateList(text) {
  const city = `[A-Z][A-Za-z]+(?:[\\s-][A-Z][A-Za-z]+){0,3}`
  const re = new RegExp(
    `((?:The\\s+)?[A-Z][A-Za-z0-9 &'.\\/-]*?${COMPANY_SUFFIX})\\s+(${city}),\\s*(${STATE_OR_ABBR})(?=\\s+[A-Z]|\\s*$|\\s*;|\\s*\\.|\\s*and\\s+another)`,
    'g'
  )
  const out = []
  let m
  while ((m = re.exec(text)) !== null) {
    const name = m[1].replace(/^and\s+/i, '').trim()
    const location = `${m[2].trim()}, ${m[3].trim()}`
    if (looksLikeCompany(name) && looksLikeLocation(location)) out.push({ name, location })
  }
  return out
}

function parseNameMultiLoc(part) {
  const cleaned = part.replace(/^and\s+/i, '').trim()
  if (!cleaned || TBD_CLAUSE.test(cleaned) || JUNK_NAME.test(cleaned)) return null

  const multi = cleaned.match(
    new RegExp(`^(.+?),\\s*(.+?,\\s*${STATE_OR_ABBR}.*)$`, 'i')
  )
  if (multi && looksLikeCompany(multi[1]) && /,/.test(multi[2])) {
    return { name: multi[1].trim(), location: multi[2].trim() }
  }

  const m = cleaned.match(
    new RegExp(`^(.+?),\\s*([^,]+),\\s*(${STATE_OR_ABBR})\\s*$`, 'i')
  )
  if (m && looksLikeCompany(m[1])) {
    return { name: m[1].trim(), location: `${m[2].trim()}, ${m[3].trim()}` }
  }

  const inCity = cleaned.match(/^(.+?)\s+in\s+([A-Z][A-Za-z .',-]+)$/)
  if (inCity && looksLikeCompany(inCity[1]) && inCity[1].split(/\s+/).length <= 8) {
    return { name: inCity[1].trim(), location: inCity[2].trim() }
  }

  if (looksLikeCompany(cleaned) && cleaned.length <= 90) {
    return { name: cleaned, location: null }
  }
  return null
}

/** Parse one contractor clause after "will be" / "are". */
export function parseContractorClause(raw) {
  let text = raw.trim().replace(/^:\s*/, '')
  if (!text) return null

  text = text.replace(/\s*;?\s*and\s+another\b.+$/i, '').trim()
  if (!text || TBD_CLAUSE.test(text)) return null

  // "FLIR Inc. in Boston, Massachusetts and Laser Devices, Inc. in Monterey, California"
  const stateTail = `(?:${US_STATES}|[A-Z]{2}\\b)`
  const inCityCompany =
    '(?:The\\s+)?(?:[A-Z][A-Za-z0-9 &\'./-]+(?:,\\s*(?:Inc|LLC|Corp|Corporation|Company))?\\.?|[A-Z][A-Za-z0-9 &\'./-]*?(?:Inc|LLC|Corp|Corporation|Company|Systems|Industries)\\.?)'
  const inCityOneRe = new RegExp(
    `^\\s*(?:and\\s+)?(${inCityCompany})\\s+in\\s+([A-Z][A-Za-z .'-]+,\\s*${stateTail})`,
    'i',
  )
  if (/\bin\s+[A-Z]/i.test(text) && /\sand\s/i.test(text)) {
    const chunks = text.split(/\s+and\s+/i)
    const names = [], locs = []
    for (const chunk of chunks) {
      const m = chunk.match(inCityOneRe)
      if (!m) continue
      const name = m[1].trim()
      const location = m[2].trim()
      if (looksLikeCompany(name) && looksLikeLocation(location)) {
        names.push(name)
        locs.push(location)
      }
    }
    if (names.length >= 2) {
      return { name: names.join(' / '), location: locs.join(' / ') }
    }
  }
  const inCityPairRe = new RegExp(
    `(${inCityCompany})\\s+in\\s+([A-Z][A-Za-z .'-]+,\\s*${stateTail})`,
    'gi',
  )
  const inCityPairs = [...text.matchAll(inCityPairRe)]
  if (inCityPairs.length >= 1) {
    const names = [], locs = []
    for (const m of inCityPairs) {
      const name = m[1].trim()
      const location = m[2].trim()
      if (looksLikeCompany(name) && looksLikeLocation(location)) {
        names.push(name)
        locs.push(location)
      }
    }
    if (names.length) {
      return { name: names.join(' / '), location: locs.join(' / ') }
    }
  }

  // "Viasat, Incorporated, headquartered in Carlsbad, CA, and Data Link Solutions, headquartered in Cedar Rapids, IA"
  // Also: "Boeing Company, based in Arlington, VA; Raytheon…, located in Forest, MS; and BAE…, situated in Falls Church, VA"
  if (/\b(?:located|headquartered|based|situated)\s+in\b/i.test(text)) {
    const chunks = text.split(/;\s*(?:and\s+)?|,\s*and\s+/)
    if (chunks.length > 1 || /\b(?:headquartered|based|situated)\s+in\b/i.test(text)) {
      const names = [], locs = []
      for (const chunk of chunks) {
        const hq = chunk.trim().match(/^(.+?),?\s+(?:located|headquartered|based|situated)\s+in\s+(.+)$/i)
        if (!hq) continue
        const name = hq[1].trim()
        const location = hq[2].trim().replace(/\.\s*$/, '')
        if (looksLikeCompany(name)) {
          names.push(name)
          locs.push(location)
        }
      }
      if (names.length) {
        return { name: names.join(' / '), location: locs.join(' / ') }
      }
    }

    const locatedIn = text.match(/^(.+?),?\s+(?:located|headquartered|based|situated)\s+in\s+(.+)$/i)
    if (locatedIn) {
      const name = locatedIn[1].trim()
      let location = locatedIn[2].trim().split(/\.\s+The\s+(?:principal|prime|primary)\s+/i)[0].trim()
      location = location.replace(/\.\s*$/, '').trim()
      if (!looksLikeCompany(name)) return null
      return { name, location }
    }
  }

  const ofLoc = text.match(
    new RegExp(`^(.+?)\\s+of\\s+([A-Z][A-Za-z .'-]+,\\s*(?:${STATE_OR_ABBR}))\\s*$`, 'i'),
  )
  if (ofLoc && looksLikeCompany(ofLoc[1])) {
    return { name: ofLoc[1].trim(), location: ofLoc[2].trim() }
  }

  if (text.includes(';')) {
    const names = [], locs = []
    for (const part of text.split(/;\s*(?:and\s+)?/)) {
      const parsed = parseNameMultiLoc(part)
      if (!parsed) continue
      names.push(parsed.name)
      if (parsed.location) locs.push(parsed.location)
    }
    if (!names.length) return null
    return {
      name: names.join(' / '),
      location: locs.length ? locs.join(' / ') : null,
    }
  }

  const loose = parseCityStateList(text)
  if (loose.length >= 1) {
    return {
      name: loose.map(x => x.name).join(' / '),
      location: loose.map(x => x.location).join(' / '),
    }
  }

  return parseNameMultiLoc(text)
}

/**
 * Extract all principal/prime-contractor sentences from DSCA press-release text.
 */
export function extractContractors(fullText) {
  const text = protectAbbrevs(fullText)

  const usgStock =
    /(?:transferred|provided|coming|drawn|sale)\s+from\s+U\.?\s*S\.?\s+Government\s+stock\b/i.test(text) ||
    /\bfrom\s+U\.?\s*S\.?\s+Government\s+stock\b/i.test(text)
  const usmcStock =
    /(?:transferred|provided|coming|drawn|sale)\s+from\s+(?:United\s+States\s+Marine\s+Corps|U\.?S\.?\s+Marine\s+Corps|USMC)\s+stock\b/i.test(
      text,
    ) || /\bfrom\s+(?:United\s+States\s+Marine\s+Corps|U\.?S\.?\s+Marine\s+Corps|USMC)\s+stock\b/i.test(text)
  const navyStock =
    /(?:provided|coming|drawn|sale|procured)\s+from\s+U\.?S\.?\s+Navy\s+(?:stock|stocks|inventory)\b/i.test(text) ||
    /\bfrom\s+U\.?S\.?\s+Navy\s+(?:stock|stocks|inventory)\b/i.test(text)
  const armyStock =
    /(?:provided|coming|drawn|sale)\s+from\s+U\.?S\.?\s+Army\s+(?:stock|inventory|stocks)\b/i.test(text) ||
    /\bfrom\s+U\.?S\.?\s+Army\s+(?:stock|inventory|stocks)\b/i.test(text) ||
    /\bfrom\s+U\.?S\.?\s+stock\b/i.test(text) ||
    /\bwill be from\s+U\.?S\.?\s+stock\b/i.test(text)

  if (usgStock || usmcStock || navyStock || armyStock) {
    const hasNamedPrime = /(?:principal|prime|primary)\s+(?:U\.?S\.?\s+)?(?:contractors?|vendors?)\(?s?\)?\s+(?:for\s+[^.]*?\s+)?(?:will be|will include|are|is)\s+(?!determined|identified|not known|provided)/i.test(
      text,
    )
    if (!hasNamedPrime) {
      const label = usgStock
        ? 'U.S. Government inventory'
        : usmcStock
          ? 'U.S. Marine Corps inventory'
          : navyStock
            ? 'U.S. Navy inventory'
            : 'U.S. Army inventory'
      return { contractor: label, contractorLocation: null }
    }
  }

  // Standard: "principal/prime contractor(s) … will be / are / is …"
  const re =
    /(?:principal|prime|primary)\s+(?:U\.?S\.?\s+)?(?:contractors?|vendors?|suppliers?)\(?s?\)?(?:\s+and\s+integrators?)?\s+(?:for\s+[^.]*?\s+|involved in (?:this )?(?:program|sale)\s+|on the sale\s+)?(?:will be|will include|are|is)\s*:?\s*(.+?)(?=\s+(?:There are no known|Implementation of this|The purchaser|The Government of|The U\.?\s*S\.?\s+Government|Offsets? agreements?|Any offset|This proposed sale|Additional contractors|Final assembly|At this time)\b|\.\s+(?:There|Implementation|The purchaser|The Government|The U\.?\s*S\.?\s+Government|Offsets?|Any offset|Additional|Final|At this time|The\s+(?:principal|prime|primary)\s+(?:U\.?S\.?\s+)?(?:contractor|vendor)))/gi

  // Missing verb (rare): "The prime contractor Raytheon Missile Systems, Tucson, Arizona."
  const missingVerbRe =
    /(?:principal|prime)\s+(?:U\.?S\.?\s+)?contractor\s+((?:The\s+)?[A-Z][^.]{2,120}?(?:Company|Corporation|Systems|Inc|LLC|Defense|Aerospace|Missiles|Raytheon|Boeing|Lockheed|Northrop|General|BAE|Kongsberg|Electric)[^.]*)\./gi

  // "a number of contractors involved … including but not limited to A, B, and C"
  const includingListRe =
    /contractors?\s+involved[^.!?]{0,120}?including(?:\s+but\s+not\s+limited\s+to)?\s+(.+?)(?=\.\s*(?:There|Implementation|The|Offsets?|Any offset)|There are no known)/gi

  const names = []
  const locs = []

  function absorb(clause) {
    let cleaned = clause.trim().replace(/^(?:will be|are|is)\s+/i, '')
    const parsed = parseContractorClause(cleaned)
    if (!parsed?.name) return
    for (const name of parsed.name.split(/\s*\/\s*/)) {
      const n = name.trim().replace(/^(?:will be|are|is|for)\s+/i, '')
      if (/^(?:for|is|will be)\b/i.test(n)) continue
      if (looksLikeCompany(n) && !names.includes(n)) names.push(n)
    }
    if (parsed.location) {
      for (const loc of parsed.location.split(/\s*\/\s*/)) {
        if (loc && looksLikeLocation(loc) && !locs.includes(loc)) locs.push(loc)
      }
    }
  }

  function absorbNameList(clause) {
    const parts = clause
      .replace(/\.$/, '')
      .split(/,\s*(?:and\s+)?|\s+and\s+/)
      .map(s => s.trim())
      .filter(Boolean)
    for (const part of parts) {
      if (looksLikeCompany(part) && !names.includes(part)) names.push(part)
    }
  }

  let m
  while ((m = re.exec(text)) !== null) absorb(m[1])
  while ((m = missingVerbRe.exec(text)) !== null) absorb(m[1])
  while ((m = includingListRe.exec(text)) !== null) absorbNameList(m[1])

  return {
    contractor: names.length ? names.join(' / ') : null,
    contractorLocation: locs.length ? locs.join(' / ') : null,
  }
}
