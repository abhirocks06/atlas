import { categorize } from './weaponCategories'

const MONTHS: [string, string][] = [
  ['january', 'jan'],
  ['february', 'feb'],
  ['march', 'mar'],
  ['april', 'apr'],
  ['may', 'may'],
  ['june', 'jun'],
  ['july', 'jul'],
  ['august', 'aug'],
  ['september', 'sep'],
  ['october', 'oct'],
  ['november', 'nov'],
  ['december', 'dec'],
]

function matchesText(haystack: string | null | undefined, q: string): boolean {
  if (!haystack) return false
  const h = haystack.toLowerCase()
  if (h.includes(q)) return true
  // common shorthand → category/system wording
  if (q === 'navy' && h.includes('naval')) return true
  return false
}

function monthIndexForQuery(q: string): number {
  return MONTHS.findIndex(([full, short]) => full === q || short === q)
}

/** Country / contractor page list search — systems, ids, months, categories, etc. */
export function notificationMatchesQuery(
  n: {
    system?: string | null
    contractor?: string | null
    country?: string | null
    transmittal?: string | null
    date?: string
  },
  query: string,
  opts: { includeCountry?: boolean; includeContractor?: boolean } = {},
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true

  const date = n.date || ''

  // Exact month name/abbrev ("may", "jul") → only match the sale's calendar month.
  // Avoids false hits from prose like "…support may also be included."
  const monthQ = monthIndexForQuery(q)
  if (monthQ >= 0) {
    if (date.length < 7) return false
    const mi = parseInt(date.slice(5, 7), 10) - 1
    return mi === monthQ
  }

  if (matchesText(n.system, q)) return true
  if (opts.includeContractor !== false && matchesText(n.contractor, q)) return true
  if (opts.includeCountry && matchesText(n.country, q)) return true
  if (matchesText(n.transmittal, q)) return true
  if (matchesText(categorize(n.system ?? null), q)) return true

  if (date.toLowerCase().includes(q)) return true

  // Month name prefix ("sept", "novem")
  if (date.length >= 7) {
    const mi = parseInt(date.slice(5, 7), 10) - 1
    if (mi >= 0 && mi < 12) {
      const [full, short] = MONTHS[mi]
      if (full.startsWith(q) || (q.length >= 3 && full.includes(q))) return true
      if (short.startsWith(q) && q.length >= 2) return true
    }
  }

  return false
}
