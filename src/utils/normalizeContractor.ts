/**
 * Normalizes messy contractor names from raw DSCA/State.gov data into
 * clean canonical names. Handles location suffixes, OCR artifacts,
 * leading "the", corporate suffix variants, and known company aliases.
 *
 * Input: a single contractor string (already split from ' / ' multi-contractor lists)
 * Output: a clean canonical display name
 */
export function normalizeContractor(raw: string): string {
  // Strip OCR artifacts: collapse extra spaces within words
  // e.g. "S iko rsk y Airc ra ft" → "Sikorsky Aircraft"
  let s = raw.replace(/\b(\w)\s+(\w{1,3})\s+(\w)/g, '$1$2$3').trim()
  // Repeat once more for remaining artifacts
  s = s.replace(/\b(\w)\s+(\w{1,3})\s+(\w)/g, '$1$2$3').trim()

  // Strip leading "the " (case insensitive)
  s = s.replace(/^the\s+/i, '')

  // Stock / inventory draws (not a commercial prime)
  if (/marine\s+corps|USMC/i.test(s) && /stock|inventory/i.test(s)) {
    return 'U.S. Marine Corps inventory'
  }
  if (/navy/i.test(s) && /stock|inventory/i.test(s)) {
    return 'U.S. Navy inventory'
  }
  if (/government/i.test(s) && /stock|inventory/i.test(s)) {
    return 'U.S. Government inventory'
  }
  if (/army\s+(stock|inventory)|coming from US Army|from U\.?S\.?\s+Army/i.test(s)) {
    return 'U.S. Army inventory'
  }

  // ── OCR garbled known company names ────────────────────────────────────────
  // e.g. "S iko rsk y Airc ra ft Co mpa ny in S tratford"
  if (/s\s*iko\s*rsk\s*y/i.test(s)) return 'Sikorsky'
  // e.g. "G eneral Electric Aircraft Company in Lynn"
  if (/g\s+eneral\s+electric|ge\s*nera\s+l\s+elec/i.test(s)) return 'GE Aerospace'

  // ── Javelin Joint Venture (Raytheon + Lockheed Martin) ─────────────────────
  if (/javelin\s+joint\s+venture|joint\s+javelin\s+venture/i.test(s)) return 'Javelin Joint Venture'

  // ── Sikorsky before Lockheed Martin (LM acquired Sikorsky but it stays Sikorsky) ──
  if (/sikorsky/i.test(s)) return 'Sikorsky'

  // ── Major primes ────────────────────────────────────────────────────────────
  if (/lockheed[- ]martin/i.test(s)) return 'Lockheed Martin'
  if (/\braytheon\b|rtx\s+(corp|missile|missile\s+defense|technologies|mdsc)/i.test(s)) return 'RTX'
  if (/^rtx\s+corp/i.test(s)) return 'RTX'
  if (/^rtx$/i.test(s)) return 'RTX'

  if (/northrop\s+grumman/i.test(s)) return 'Northrop Grumman'

  // Boeing (must come after Bell Helicopter which mentions Boeing in JV)
  if (/boeing\s+helicopter\s+and\s+boeing|bell\s+helicopter\s+and\s+boeing/i.test(s)) return 'Bell Boeing'
  if (/\bboeing\b/i.test(s)) return 'Boeing'

  if (/huntington\s+ingalls/i.test(s)) return 'HII'

  // BAE Systems (before bare "BAE of X")
  if (/bae\s+systems|british\s+aerospace\s+enterprise|bae\s+of\b|\bbae\b/i.test(s)) return 'BAE Systems'

  // General Dynamics (before "General Electric" or "General Atomics")
  if (/general\s+dynamics/i.test(s)) return 'General Dynamics'

  // General Atomics
  if (/general\s+atom(ic|ics)/i.test(s)) return 'General Atomics'

  // General Electric / GE
  if (/general\s+electric|ge\s+aviation|ge\s+of\b|ge\s+aerospace/i.test(s)) return 'GE Aerospace'

  // L3Harris
  if (/l[\-\s]?3[\s]*(harris|communications|wescam|technologies)|harris\s+corp|l3harris|\bthe\s+harris\s+corp/i.test(s)) return 'L3Harris Technologies'
  if (/^harris$/i.test(s)) return 'L3Harris Technologies'

  // Bell / Textron
  if (/bell\s+(helicopter|textron)/i.test(s)) return 'Bell Textron'
  if (/^bell(\s+(corp|corporation))?$/i.test(s)) return 'Bell Textron'
  if (/textron\s+(aviation|defense|systems)/i.test(s)) return 'Textron'

  // Collins Aerospace (formerly Rockwell Collins / UTC Aerospace)
  if (/collins\s+aerospace|rockwell\s+collins/i.test(s)) return 'Collins Aerospace'

  // Honeywell
  if (/honeywell/i.test(s)) return 'Honeywell'

  // Rolls-Royce
  if (/rolls[- ]royce/i.test(s)) return 'Rolls-Royce'

  // Pratt & Whitney
  if (/pratt\s+(and|&)\s+whitney|pratt\s+whitney/i.test(s)) return 'Pratt & Whitney'

  // AM General
  if (/^am\s+general/i.test(s)) return 'AM General'

  // CAE
  if (/^cae(\s+usa)?$/i.test(s)) return 'CAE'

  // SRC
  if (/^src(\s+(corp|corporation|inc))?$/i.test(s)) return 'SRC'

  // AeroVironment
  if (/aerovironment/i.test(s)) return 'AeroVironment'

  // Aerojet / Aerojet Rocketdyne
  if (/aerojet/i.test(s)) return 'Aerojet Rocketdyne'

  // Leonardo / DRS (Leonardo subsidiary)
  if (/\bleonardo\b|drs\s+north\s+america/i.test(s)) return 'Leonardo DRS'

  // Sierra Nevada Corporation
  if (/sierra\s+nevada/i.test(s)) return 'Sierra Nevada'

  // Oshkosh
  if (/oshkosh/i.test(s)) return 'Oshkosh'

  // Gulfstream
  if (/gulfstream/i.test(s)) return 'Gulfstream'

  // ViaSat / Viasat
  if (/viasat/i.test(s)) return 'Viasat'

  // Kongsberg
  if (/kongsberg/i.test(s)) return 'Kongsberg'

  // Repkon
  if (/repkon/i.test(s)) return 'Repkon USA'

  // Longbow LLC (Lockheed Martin / Northrop Grumman JV for Apache fire-control radar)
  if (/longbow\s+(limited\s+liability|llc)/i.test(s)) return 'Longbow LLC'

  // Leidos
  if (/leidos/i.test(s)) return 'Leidos'

  // Booz Allen Hamilton
  if (/booz\s*allen/i.test(s)) return 'Booz Allen Hamilton'

  // Vinell Arabia — no known logo but normalize anyway
  if (/vinell/i.test(s)) return 'Vinell Arabia'

  // ── Generic cleanup for everything else ─────────────────────────────────────
  // Remove parenthetical asides: "(GEAC)", "(United Technologies)", etc.
  s = s.replace(/\s*\([^)]*\)/g, '').trim()
  // Remove location suffixes: "in [City]", "of [City]"
  s = s.replace(/\s+(?:in|of)\s+\w[\w\s,]*$/i, '').trim()
  // Remove trailing corporate designations
  s = s.replace(/\s*,?\s*(Corporation|Corp\.?|Incorporated|Inc\.?|LLC|Ltd\.?|Company|Co\.)$/i, '').trim()

  return s || raw.trim()
}
