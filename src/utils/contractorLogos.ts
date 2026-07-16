// Maps normalized contractor name fragments to their domain for Clearbit logo API
// Usage: https://logo.clearbit.com/{domain}

const CONTRACTOR_DOMAINS: [RegExp, string][] = [
  [/boeing/i, 'boeing.com'],
  [/lockheed/i, 'lockheedmartin.com'],
  [/rtx|raytheon/i, 'rtx.com'],
  [/^hii$/i, 'hii.com'],
  [/general dynamics/i, 'gd.com'],
  [/northrop/i, 'northropgrumman.com'],
  [/l3harris|l3 harris/i, 'l3harris.com'],
  [/bae systems/i, 'baesystems.com'],
  [/am general/i, 'amgeneral.com'],
  [/bell textron|bell helicopter|bell boeing/i, 'bellflight.com'],
  [/textron/i, 'textron.com'],
  [/sikorsky/i, 'lockheedmartin.com'],
  [/general atomics/i, 'ga.com'],
  [/leonardo drs/i, 'leonardodrs.com'],
  [/leidos/i, 'leidos.com'],
  [/v2x/i, 'v2x.com'],
  [/flir/i, 'flir.com'],
  [/cae usa|cae inc/i, 'cae.com'],
  [/elbit/i, 'elbitsystems.com'],
  [/thales/i, 'thalesgroup.com'],
  [/airbus/i, 'airbus.com'],
  [/rolls.royce/i, 'rolls-royce.com'],
  [/ge aerospace|general electric/i, 'geaerospace.com'],
  [/pratt.whitney/i, 'prattwhitney.com'],
  [/collins aerospace/i, 'collinsaerospace.com'],
  [/honeywell/i, 'honeywell.com'],
  [/kbr/i, 'kbr.com'],
  [/vectrus|v2x/i, 'v2x.com'],
  [/oshkosh/i, 'oshkoshdefense.com'],
  [/bwx technologies|bwxt/i, 'bwxt.com'],
  [/draper/i, 'draper.com'],
  [/saic/i, 'saic.com'],
  [/moog/i, 'moog.com'],
  [/aerojet/i, 'rocket.com'],
]

export function getContractorLogoUrl(contractor: string): string | null {
  for (const [pattern, domain] of CONTRACTOR_DOMAINS) {
    if (pattern.test(contractor)) {
      return `https://logo.clearbit.com/${domain}`
    }
  }
  return null
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
