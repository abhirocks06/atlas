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
  'Anduril': 'Anduril Industries',
  'AAR': 'AAR Corporation',
  'AAR Manufacturing': 'AAR Corporation',
  'ATK': 'Orbital ATK',
  'Alliant Techsystems': 'Orbital ATK',
  'SRC': 'SRC Inc.',
  'RTX': 'RTX Corporation',
  'Boeing': 'The Boeing Company',
  'Sikorsky': 'Sikorsky Aircraft',
  'Navistar': 'Navistar Defense',
  'FLIR': 'FLIR Systems',
  'Colt': "Colt's Manufacturing",
  'Gulfstream': 'Gulfstream Aerospace',
  'Maxar': 'Maxar Technologies',
  'Honeywell': 'Honeywell International',
  'Moog': 'Moog Inc.',
  'CAE': 'CAE Inc.',
  'Viasat': 'Viasat Inc.',
  'Draper': 'Draper Laboratory',
  'KBR': 'KBR Inc.',
  'V2X': 'V2X Inc.',
  'Vectrus': 'V2X Inc.',
  'Thales': 'Thales Group',
  'Textron': 'Textron Inc.',
  'Saab': 'Saab AB',
  'Goodrich': 'Goodrich Corporation',
  'Selex': 'Selex ES',
  'Cobham': 'Cobham Defense Electronics',
  'Cobham Aerospace Connectivity': 'Cobham Defense Electronics',
  'COBHAM Aerospace Connectivity': 'Cobham Defense Electronics',
  'AgustaWestland Philadelphia Corporation': 'AgustaWestland',
  'AgustaWestland Helicopter Company': 'AgustaWestland',
  'Caterpillar Inc.': 'Caterpillar',
  'Spirit AeroSystems': 'Spirit Aero',
  'Spirit Aerosystems': 'Spirit Aero',
  'Martin-Baker': 'Martin Baker',
  'Martin-Baker Aircraft': 'Martin Baker',
  'Martin Baker Aircraft': 'Martin Baker',
  'Symetrics': 'Symmetrics',
  'Symetrics Industries': 'Symmetrics',
  'Extant Aerospace': 'Symmetrics',
  'Pole/Zero': 'Pole Zero',
  'G.C. Micro': 'GC Micro',
  'GC Micro Corporation': 'GC Micro',
}
