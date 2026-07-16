import { normalizeContractor } from './normalizeContractor'

export interface ContractorEntry {
  /** Normalized display name */
  name: string
  location: string | null
}

/** Stock draws and similar — shown as Source, never as a commercial contractor. */
export function isInventorySource(contractor: string | null | undefined): boolean {
  if (!contractor?.trim()) return false
  return /(?:army|marine\s+corps|navy|air\s+force|government)\s+(stock|inventory)|coming from US (?:Army|Marine|Navy|Government)|from U\.?S\.?\s+(?:Army|Marine|Navy|Government)|U\.?S\.?\s+Marine\s+Corps\s+(?:stock|inventory)|USMC\s+(?:stock|inventory)|U\.?S\.?\s+Government\s+(?:stock|inventory)/i.test(
    contractor,
  )
}

/** Display label for non-contractor supply sources, or null. */
export function supplySource(contractor: string | null | undefined): string | null {
  if (!isInventorySource(contractor)) return null
  const s = contractor!.trim()
  if (/marine\s+corps|USMC/i.test(s)) return 'U.S. Marine Corps inventory'
  if (/navy/i.test(s)) return 'U.S. Navy inventory'
  if (/air\s+force/i.test(s)) return 'U.S. Air Force inventory'
  if (/government/i.test(s)) return 'U.S. Government inventory'
  return 'U.S. Army inventory'
}

function cleanLocation(loc: string | null | undefined): string | null {
  if (!loc) return null
  const s = loc
    .replace(/^and\s+/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[;,]\s*$/, '')
    .trim()
  return s || null
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
    /\b(not known|to be determined|determined from|approved vendors|no prime|will be part of a new contractor|unknown at this time|not associated with)\b/i.test(
      rawContractor,
    )
  ) {
    return []
  }

  // Slash-separated parallel lists
  if (rawContractor?.includes(' / ') || rawLocation?.includes(' / ')) {
    const names = (rawContractor ?? '').split(/\s*\/\s*/).map(s => s.trim()).filter(Boolean)
    const locs = (rawLocation ?? '').split(/\s*\/\s*/).map(s => s.trim())
    return names.map((n, i) => entry(n, cleanLocation(locs[i] || null)))
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

    // "and Company in Place" continuation
    const andIn = rawLocation.match(/^and\s+(.+)$/i)
    if (andIn && rawContractor) {
      const rest = andIn[1]
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
    return [entry(rawContractor, cleanLocation(rawLocation))]
  }

  return []
}

function dedupeEntries(entries: ContractorEntry[]): ContractorEntry[] {
  const out: ContractorEntry[] = []
  const seen = new Set<string>()
  for (const e of entries) {
    if (!e.name || seen.has(e.name)) continue
    seen.add(e.name)
    out.push(e)
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
