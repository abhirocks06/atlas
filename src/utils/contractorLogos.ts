// Local contractor logos in /public/contractor-logos (pulled via scripts/pull-contractor-logos.mjs)

const CONTRACTOR_DOMAINS: [RegExp, string][] = [
  [/rtx|raytheon/i, 'rtx.com'],
  [/booz\s*allen/i, 'boozallen.com'],
  [/^hii$/i, 'hii.com'],
  [/huntington\s+ingalls/i, 'huntingtoningalls.com'],
  [/general dynamics/i, 'gd.com'],
  [/northrop/i, 'northropgrumman.com'],
  [/l3harris|l3 harris/i, 'l3harris.com'],
  [/bae systems|^bae$/i, 'baesystems.com'],
  [/am general/i, 'amgeneral.com'],
  [/bell textron|bell helicopter|bell boeing|bell flight/i, 'bellflight.com'],
  [/beechcraft|hawker\s+beechcraft/i, 'beechcraft.com'],
  [/textron/i, 'textron.com'],
  [/sikorsky/i, 'lockheedmartin.com'],
  [/general atomics/i, 'generalatomics.com'],
  [/leonardo drs/i, 'leonardodrs.com'],
  [/leidos/i, 'leidos.com'],
  [/v2x|vectrus/i, 'v2x.com'],
  [/flir/i, 'flir.com'],
  [/cae\b/i, 'cae.com'],
  [/elbit/i, 'elbitsystems.com'],
  [/thales/i, 'thalesgroup.com'],
  [/airbus/i, 'airbus.com'],
  [/rolls.royce/i, 'rolls-royce.com'],
  [/ge aerospace|general electric/i, 'geaerospace.com'],
  [/pratt\s*&\s*whitney|pratt\s+whitney/i, 'prattwhitney.com'],
  [/collins aerospace/i, 'collinsaerospace.com'],
  [/honeywell/i, 'honeywell.com'],
  [/kbr/i, 'kbr.com'],
  [/oshkosh/i, 'oshkoshdefense.com'],
  [/bwx technologies|bwxt/i, 'bwxt.com'],
  [/draper/i, 'draper.com'],
  [/saic/i, 'saic.com'],
  [/moog/i, 'moog.com'],
  [/aerojet/i, 'rocket.com'],
  [/navistar/i, 'navistar.com'],
  [/colt/i, 'colt.com'],
  [/spartan college|spartan/i, 'spartan.edu'],
  [/kratos/i, 'kratosdefense.com'],
  [/anduril/i, 'anduril.com'],
  [/maxar/i, 'maxar.com'],
  [/zone\s*5/i, 'zone5tech.com'],
  [/coaspire/i, 'coaspire.com'],
  [/allison\s+transmission/i, 'allisontransmission.com'],
  [/marvin/i, 'marvingroup.com'],
  [/aero\s*vironment/i, 'avinc.com'],
  [/\bsrc\b/i, 'srcinc.com'],
  [/boeing/i, 'boeing.com'],
  [/lockheed/i, 'lockheedmartin.com'],
  [/toyota/i, 'toyota.com'],
  [/\baar\b/i, 'aarcorp.com'],
  [/gulfstream/i, 'gulfstream.com'],
  [/viasat/i, 'viasat.com'],
]

function domainToSlug(domain: string): string {
  return domain.replace(/\./g, '-')
}

/** Local logo path, or null if we don't have a mapping. */
export function getContractorLogoUrl(contractor: string): string | null {
  // Service inventory / USG provider draws (not commercial primes)
  if (/navy\s+inventory|U\.?S\.?\s+Navy\s*\(NAVAIR\)|naval\s+air\s+systems|\bnavair\b/i.test(contractor)) {
    return '/contractor-logos/us-navy.png'
  }
  if (
    /U\.?S\.?\s+Government/i.test(contractor) ||
    /vendors TBD/i.test(contractor) ||
    /(?:army|marine\s+corps|air\s+force)\s+inventory/i.test(contractor)
  ) {
    return '/contractor-logos/us-government.png'
  }

  for (const [pattern, domain] of CONTRACTOR_DOMAINS) {
    if (pattern.test(contractor)) {
      return `/contractor-logos/${domainToSlug(domain)}.png`
    }
  }
  return null
}

export function contractorLogoClassName(_contractor: string): string {
  return ''
}

const warmed = new Set<string>()

export function prefetchContractorLogo(contractor: string): void {
  const url = getContractorLogoUrl(contractor)
  if (!url || warmed.has(url)) return
  warmed.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function prefetchContractorLogos(contractors: Iterable<string>): void {
  for (const name of contractors) prefetchContractorLogo(name)
}

export function getContractorInitials(contractor: string): string {
  return contractor
    .replace(/\b(the|inc|llc|corp|company|co|ltd|lp|plc)\b\.?/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}
