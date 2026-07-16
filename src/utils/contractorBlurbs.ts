import blurbs from '../../data/contractor_blurbs.json'

type BlurbEntry = {
  blurb: string
  source?: string
  updatedAt?: string
}

const map = blurbs as Record<string, BlurbEntry>

export function getContractorBlurb(contractor: string): string | null {
  return map[contractor]?.blurb ?? map[ALIASES[contractor] ?? '']?.blurb ?? null
}

/** Older display names that map to a canonical blurb key. */
const ALIASES: Record<string, string> = {
  'Longbow Limited Liability': 'Longbow LLC',
}
