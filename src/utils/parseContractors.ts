import { normalizeContractor } from './normalizeContractor'

export interface ContractorEntry {
  /** Normalized display name */
  name: string
  location: string | null
}

const USG_VENDORS_TBD = 'U.S. Government / vendors TBD'
const USG_LABEL = 'U.S. Government'
const US_NAVY_NAVAIR = 'U.S. Navy (NAVAIR)'
const US_NAVY_INVENTORY = 'U.S. Navy inventory'

/** U.S. Navy command / NAVAIR acting as provider (not a commercial prime). */
export function isNavyCommandSource(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const s = text.trim()
  if (s.includes(' / ')) return false
  if (/navy\s+(stock|inventory)/i.test(s)) return false
  return (
    /\bnavair\b/i.test(s) ||
    /naval\s+air\s+systems\s+command/i.test(s) ||
    /^u\.?s\.?\s+navy[,']?\s+naval\s+air/i.test(s) ||
    /^the\s+u\.?s\.?\s+navy,\s+naval\s+air/i.test(s) ||
    /^u\.?s\.?\s+navy\s*\(navair\)$/i.test(s)
  )
}

function isInventorySourcePart(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  // Canonical USG provider labels only (not “no prime / various contractors”)
  if (/^U\.?S\.?\s+Government\s*\/\s*vendors TBD$/i.test(t)) return true
  if (/^U\.?S\.?\s+Government$/i.test(t)) return true
  if (isNavyCommandSource(t)) return true
  return /(?:army|marine\s+corps|navy|air\s+force|government)\s+(stock|inventory)|coming from US (?:Army|Marine|Navy|Government)|from U\.?S\.?\s+(?:Army|Marine|Navy|Government)|U\.?S\.?\s+Marine\s+Corps\s+(?:stock|inventory)|USMC\s+(?:stock|inventory)|U\.?S\.?\s+Government\s+(?:stock|inventory)/i.test(
    t,
  )
}

/** Stock draws, no-prime USG work, etc. — Provider column, never a commercial contractor. */
export function isInventorySource(contractor: string | null | undefined): boolean {
  if (!contractor?.trim()) return false
  const s = contractor.trim()
  // Keep "U.S. Government / vendors TBD" atomic (slash is part of the label)
  if (/^U\.?S\.?\s+Government\s*\/\s*vendors TBD$/i.test(s)) return true
  // Only wholly-provider lists count; mixed commercial + NAVAIR stays parseable
  if (s.includes(' / ')) {
    const parts = s.split(/\s*\/\s*/).map(p => p.trim()).filter(Boolean)
    return parts.length > 0 && parts.every(isInventorySourcePart)
  }
  return isInventorySourcePart(s)
}

/** True when this label must never open a contractor page / enter Network rankings. */
export function isSupplyProviderLabel(label: string | null | undefined): boolean {
  if (!label?.trim()) return false
  if (isInventorySource(label)) return true
  if (isNavyCommandSource(label)) return true
  return /inventory|U\.?S\.?\s+Government|vendors TBD|U\.?S\.?\s+Navy\s*\(NAVAIR\)/i.test(label)
}

/** Display label for non-contractor supply providers, or null. */
export function supplyProvider(contractor: string | null | undefined): string | null {
  if (!contractor?.trim()) return null
  const s = contractor.trim()

  // Atomic label — must run before slash-splitting
  if (/^U\.?S\.?\s+Government\s*\/\s*vendors TBD$/i.test(s)) return USG_VENDORS_TBD
  if (/^U\.?S\.?\s+Government$/i.test(s)) return USG_LABEL
  if (isNavyCommandSource(s)) return US_NAVY_NAVAIR

  // Slash lists: surface NAVAIR / inventory even alongside commercial primes
  if (s.includes(' / ')) {
    for (const part of s.split(/\s*\/\s*/)) {
      const label = supplyProvider(part)
      if (label) return label
    }
  }

  if (!isInventorySource(s)) return null
  if (/marine\s+corps|USMC/i.test(s)) return 'U.S. Marine Corps inventory'
  if (/navy/i.test(s)) return US_NAVY_INVENTORY
  if (/air\s+force/i.test(s)) return 'U.S. Air Force inventory'
  if (/government\s+(stock|inventory)/i.test(s)) return 'U.S. Government inventory'
  if (/government/i.test(s) && /inventory|stock/i.test(s)) return 'U.S. Government inventory'
  return 'U.S. Army inventory'
}

export { USG_VENDORS_TBD, USG_LABEL, US_NAVY_NAVAIR }


function cleanLocation(loc: string | null | undefined): string | null {
  if (!loc) return null
  const s = loc
    .replace(/^and\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim()
  return s || null
}

/** US states / DC — OCR sometimes splits "Owego; New York" into a fake contractor. */
const US_STATE_NAME =
  /^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia|D\.?C\.?)$/i

function isPlaceOnlyName(name: string): boolean {
  const s = name.trim()
  if (!s) return true
  if (US_STATE_NAME.test(s)) return true
  // Bare city names that leaked from plant-location lists
  if (/^(Tucson|Huntsville|Anniston|London|Mesa|Lynn|Orlando|Bethesda|Camden)$/i.test(s)) return true
  // Bare "City, ST" or "City, State" leftovers
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*[A-Z]{2}$/.test(s)) return true
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,\s*(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i.test(s)) {
    return true
  }
  // Division fragments, not firms
  if (/^communications$/i.test(s)) return true
  return false
}

/** Press-release prose that leaked into a slash-separated contractor field. */
function isProseFragment(name: string): boolean {
  const s = name.trim()
  if (!s) return true
  if (/\b(will be|are being|to be)\s+(produced|manufactured|built|assembled|provided)\b/i.test(s)) return true
  if (/\bwill provide\b/i.test(s)) return true
  if (/\b(produced|manufactured|built|assembled)\s+at\b/i.test(s)) return true
  if (/^(vehicles|aircraft|systems|equipment|items|missiles|helicopters)\s+\w+/i.test(s)) return true
  if (/\band\s+US\s+Government\s+activities\b/i.test(s)) return true
  return false
}

/** Split "Company in/of City" when the suffix looks like a place, not another firm. */
function splitEmbeddedLocation(raw: string): { name: string; location: string | null } {
  const m = raw.match(/^(.+?)\s+(?:located\s+)?(?:in|of)\s+(.+)$/i)
  if (!m) return { name: raw.trim(), location: null }
  const place = m[2].trim()
  // Avoid splitting joint names like "Raytheon of Lockheed" — places usually have comma, state, or known city words
  if (/,/.test(place) || /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/i.test(place)
    || /\b(California|Arizona|Florida|Texas|Virginia|Massachusetts|Connecticut|Alabama|Maryland|Pennsylvania|York|Beach|Park|Falls|Church|Worth|Orlando|Tucson|Mesa|Lynn|Dallas)\b/i.test(place)) {
    return { name: m[1].trim(), location: cleanLocation(place) }
  }
  return { name: raw.trim(), location: null }
}

function entry(rawName: string, location: string | null): ContractorEntry {
  const split = splitEmbeddedLocation(rawName)
  return {
    name: normalizeContractor(split.name),
    location: location ?? split.location,
  }
}

/**
 * Parse DSCA contractor + contractorLocation into discrete companies.
 * Handles slash-separated lists and locations that bury extra firms
 * ("Mesa, AZ, and Lockheed Martin, located in Orlando, FL").
 */
export function parseContractors(
  contractor: string | null | undefined,
  location: string | null | undefined,
): ContractorEntry[] {
  const rawContractor = contractor?.trim() || null
  const rawLocation = location?.trim() || null

  // Inventory / stock draws are not commercial contractors
  if (isInventorySource(rawContractor)) return []

  // Treat TBD / unknown scrape leftovers as missing (hide Principal contractor section)
  if (
    !rawContractor ||
    /\b(not known|to be determined|determined from|approved vendors|no prime|no contractor specified|will be part of a new contractor|unknown at this time|not associated with|competitive source selection|chosen after|to be announced|to be selected|selection process|competition among)\b/i.test(
      rawContractor,
    )
  ) {
    return []
  }

  // Slash-separated parallel lists
  if (rawContractor?.includes(' / ') || rawLocation?.includes(' / ')) {
    const names = (rawContractor ?? '').split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
    const locs = (rawLocation ?? '').split(/\s*\/\s*/).map(s => s.trim())
    const entries = names
      .map((n, i) => ({ raw: n, loc: cleanLocation(locs[i] || null) }))
      // Drop USG command / inventory segments — they surface via supplyProvider
      .filter(({ raw }) => !isInventorySource(raw) && !isNavyCommandSource(raw))
      .map(({ raw, loc }) => entry(raw, loc))
    return dedupeEntries(entries)
  }

  if (rawLocation) {
    const locatedRe = /([^;]+?),\s*located in\s+([^;]+)/gi
    const matches: { company: string; loc: string; index: number }[] = []
    let m: RegExpExecArray | null
    while ((m = locatedRe.exec(rawLocation)) !== null) {
      matches.push({ company: m[1].trim(), loc: m[2].trim(), index: m.index })
    }

    if (matches.length > 0) {
      const results: ContractorEntry[] = []
      const before = rawLocation
        .slice(0, matches[0].index)
        .replace(/[,;]\s*and\s*$/i, '')
        .replace(/[,;]\s*$/, '')
        .trim()

      for (let i = 0; i < matches.length; i++) {
        let companyPart = matches[i].company.replace(/^and\s+/i, '').trim()
        let primaryLoc: string | null = i === 0 && before ? cleanLocation(before) : null

        // "Mesa, AZ, and Lockheed Martin" when before was empty
        if (!primaryLoc) {
          const andSplit = companyPart.match(/^(.+),\s*and\s+(.+)$/i)
          if (andSplit) {
            primaryLoc = cleanLocation(andSplit[1])
            companyPart = andSplit[2].trim()
          }
        }

        if (i === 0 && rawContractor) {
          results.push(entry(rawContractor, primaryLoc))
        }

        results.push(entry(companyPart, cleanLocation(matches[i].loc)))
      }

      return dedupeEntries(results)
    }

    // "City, ST, and Other Company[, Inc.]" without "located in"
    const andCompany = rawLocation.match(
      /^(.+?),\s*and\s+((?:the\s+)?[A-Z][^,]*?(?:Company|Corporation|Corp\.?|Inc\.?|LLC|Systems|Martin|Boeing|Aerospace|Dynamics|Atomic|Raytheon|RTX|Harris|Textron|BAE).*)$/i,
    )
    if (andCompany && rawContractor) {
      return dedupeEntries([
        entry(rawContractor, cleanLocation(andCompany[1])),
        entry(andCompany[2], null),
      ])
    }

    // "and Company in Place" continuation — but not "and Anniston, Alabama" (2nd plant)
    const andIn = rawLocation.match(/^and\s+(.+)$/i)
    if (andIn && rawContractor) {
      const rest = andIn[1].trim()
      if (isPlaceOnlyName(rest) || /^[A-Z][a-z]+/.test(rest) && /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|[A-Z][a-z]+)$/i.test(rest)
        && !/\b(Company|Corporation|Corp|Inc|LLC|Systems|Martin|Boeing|Aerospace|Dynamics)\b/i.test(rest)) {
        const primary = entry(rawContractor, null)
        return [{
          name: primary.name,
          location: [primary.location, cleanLocation(rest)].filter(Boolean).join('; '),
        }]
      }
      const contMatch = rest.match(/^(.+?)\s+in\s+(.+)$/i)
      return dedupeEntries([
        entry(rawContractor, null),
        entry(
          contMatch ? contMatch[1] : rest,
          contMatch ? cleanLocation(contMatch[2]) : null,
        ),
      ])
    }
  }

  // Single contractor; location may be a plain place
  if (rawContractor) {
    // Plain location that is only another place (e.g. "and Anniston, Alabama") for same firm
    if (rawLocation && /^and\s+[a-z]/i.test(rawLocation) && !/,\s*located in/i.test(rawLocation)) {
      const placeOnly = cleanLocation(rawLocation)
      // If it looks like a second city for same contractor, keep one entry with joined places
      const primary = entry(rawContractor, null)
      if (placeOnly && !/[A-Z][a-z]+\s+(Company|Corporation|Systems|Martin|Boeing|RTX)/.test(placeOnly)) {
        const baseLoc = primary.location
        return [{
          name: primary.name,
          location: [baseLoc, placeOnly].filter(Boolean).join('; '),
        }]
      }
    }
    return dedupeEntries([entry(rawContractor, cleanLocation(rawLocation))])
  }

  return []
}

function dedupeEntries(entries: ContractorEntry[]): ContractorEntry[] {
  const out: ContractorEntry[] = []
  const indexByName = new Map<string, number>()
  for (const e of entries) {
    if (!e.name || isPlaceOnlyName(e.name) || isProseFragment(e.name)) continue
    const existing = indexByName.get(e.name)
    if (existing === undefined) {
      indexByName.set(e.name, out.length)
      out.push({ ...e })
      continue
    }
    // Same firm, another plant — keep both places on one row
    const prev = out[existing]
    if (e.location && e.location !== prev.location) {
      const parts = new Set(
        [prev.location, e.location]
          .filter(Boolean)
          .flatMap(s => String(s).split(/\s*;\s*/))
          .map(s => s.trim())
          .filter(Boolean),
      )
      prev.location = [...parts].join('; ') || prev.location
    }
  }
  return out
}

/** All normalized contractor names for a notification. */
export function contractorNames(
  contractor: string | null | undefined,
  location: string | null | undefined,
): string[] {
  return parseContractors(contractor, location).map(e => e.name)
}
