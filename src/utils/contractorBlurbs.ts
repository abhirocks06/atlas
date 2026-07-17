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

/** Older / short display names that map to a canonical blurb key. */
const ALIASES: Record<string, string> = {
  'Longbow Limited Liability': 'Longbow LLC',
  'Kratos': 'Kratos Defense & Security Solutions',
  'Beechcraft': 'Beechcraft Defense',
  'Hawker Beechcraft': 'Beechcraft Defense',
  'Oshkosh': 'Oshkosh Defense',
  'Sierra Nevada': 'Sierra Nevada Corporation',
  'Kongsberg': 'Kongsberg Defence & Aerospace',
  'HII': 'Huntington Ingalls Industries',
  'ITT': 'L3Harris Technologies',
  'UTC Aerospace Systems': 'Collins Aerospace',
  'Rockwell Collins': 'Collins Aerospace',
  'VSE': 'VSE Corporation',
  'Vinell Arabia': 'Vinnell Arabia',
  'DynCorps': 'DynCorp International',
  'DynCorps International': 'DynCorp International',
  'Konsberg Defense Systems': 'Kongsberg Defence & Aerospace',
  'Marvin Engineering': 'Marvin Group',
  'Marvin Industries': 'Marvin Group',
  'AeroVironment': 'Aero Vironment',
}
