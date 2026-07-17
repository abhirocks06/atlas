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
  if (/s\s*iko\s*rsk\s*y/i.test(s)) return 'Sikorsky Aircraft'
  // e.g. "G eneral Electric Aircraft Company in Lynn"
  if (/g\s+eneral\s+electric|ge\s*nera\s+l\s+elec/i.test(s)) return 'GE Aerospace'

  // ── Javelin Joint Venture (Raytheon + Lockheed Martin) ─────────────────────
  if (/javelin\s+joint\s+venture|joint\s+javelin\s+venture/i.test(s)) return 'Javelin Joint Venture'

  // ── Sikorsky before Lockheed Martin (LM acquired Sikorsky but it stays Sikorsky) ──
  if (/sikorsky/i.test(s)) return 'Sikorsky Aircraft'

  // ── Major primes ────────────────────────────────────────────────────────────
  // Lockheed-Martin / Lockheed- Martin / Lockheed Corporation / …/MFC
  if (/lockheed[- ]\s*martin|\blockheed\b.*\bmfc\b|^lockheed(\s+(corp|corporation))?$/i.test(s)) {
    return 'Lockheed Martin'
  }
  if (/^mfc$/i.test(s)) return 'Lockheed Martin'
  if (/\braytheon\b|\brtx\b/i.test(s)) return 'RTX Corporation'

  if (/northrop|northrup|northr\s*op/i.test(s)) return 'Northrop Grumman'

  // Boeing (must come after Bell Helicopter which mentions Boeing in JV)
  if (/boeing\s+helicopter\s+and\s+boeing|bell\s+helicopter\s+and\s+boeing/i.test(s)) return 'Bell Boeing'
  if (/\bboeing\b/i.test(s)) return 'The Boeing Company'

  if (/huntington\s+ingalls|^hii$/i.test(s)) return 'Huntington Ingalls Industries'

  // BAE Systems (before bare "BAE of X")
  if (/bae\s+systems|british\s+aerospace\s+enterprise|bae\s+of\b|\bbae\b/i.test(s)) return 'BAE Systems'

  // General Dynamics (incl. GDLS / GDLS-Canada)
  if (/general\s+dynamics|\bgdls\b/i.test(s)) return 'General Dynamics'

  // Ultra Maritime (naval systems / sensors)
  if (/ultra\s+maritime/i.test(s)) return 'Ultra Maritime'

  // General Atomics
  if (/general\s+atom(ic|ics)/i.test(s)) return 'General Atomics'

  // General Electric / GE
  if (/general\s+electric|ge\s+aviation|ge\s+aerospace|ge\s+aircraft|\bge\s+of\b|^ge$/i.test(s)) return 'GE Aerospace'

  // L3Harris (incl. legacy L-3, Harris, Exelis, and ITT defense electronics spun into Exelis)
  if (/l[\-\s]?3/i.test(s)) return 'L3Harris Technologies'
  if (/harris\s+(corp|corporation|international|radio|defense)|l3harris|\bthe\s+harris\s+corp|^harris$/i.test(s)) {
    return 'L3Harris Technologies'
  }
  if (/exelis|excelis/i.test(s)) return 'L3Harris Technologies'
  // ITT Aerospace / Night Vision / Exelis-era defense units → L3Harris (not modern ITT Inc.)
  if (/\bitt\b/i.test(s)) return 'L3Harris Technologies'

  // Bell / Textron (incl. Bell-Textron hyphenation)
  if (/bell[-\s]+(helicopter|textron)/i.test(s)) return 'Bell Textron'
  if (/^bell(\s+(corp|corporation))?$/i.test(s)) return 'Bell Textron'
  if (/textron\s+(aviation|defense|systems)/i.test(s)) return 'Textron Inc.'
  if (/^textron$/i.test(s)) return 'Textron Inc.'

  // Collins Aerospace (formerly Rockwell Collins / UTC Aerospace Systems)
  if (/collins\s+aerospace|rockwell\s+collins|utc\s+aerospace/i.test(s)) return 'Collins Aerospace'

  // Honeywell
  if (/honeywell/i.test(s)) return 'Honeywell International'

  // Rolls-Royce
  if (/rolls[- ]royce/i.test(s)) return 'Rolls-Royce'

  // Pratt & Whitney
  if (/pratt\s*(and|&)\s*whitney|pratt\s+whitney/i.test(s)) return 'Pratt & Whitney'

  // American General → AM General
  if (/american\s+general/i.test(s)) return 'AM General'

  // AM General
  if (/^am\s+general/i.test(s)) return 'AM General'

  // CAE
  if (/^cae(\s+usa)?$/i.test(s) || /\bcae\b/i.test(s)) return 'CAE Inc.'

  // SRC
  if (/\bsrc\b/i.test(s)) return 'SRC Inc.'

  // Anduril Industries
  if (/anduril/i.test(s)) return 'Anduril Industries'

  // Aero Vironment (State.gov often spaces it; brand is AeroVironment)
  if (/aero\s*vironment/i.test(s)) return 'Aero Vironment'

  // Aerojet / Aerojet Rocketdyne / ATK
  if (/aerojet/i.test(s)) return 'Aerojet Rocketdyne'
  if (/\batk\b|alliant\s+techsystems|orbital\s+atk/i.test(s)) return 'Orbital ATK'

  // Leonardo / DRS (Leonardo subsidiary; historically DRS Technologies)
  if (/\bleonardo\b|\bdrs\b/i.test(s)) return 'Leonardo DRS'

  // Sierra Nevada Corporation
  if (/sierra\s+nevada/i.test(s)) return 'Sierra Nevada Corporation'

  // Oshkosh
  if (/oshkosh/i.test(s)) return 'Oshkosh Defense'

  // Gulfstream
  if (/gulfstream/i.test(s)) return 'Gulfstream Aerospace'

  // FN America (FN Herstal / FN Enterprise / Fabrique Nationale)
  if (/\bfn\s+(america|enterprise|manufacturing)\b|fabrique\s+nationale|\bfn\s+herstal\b/i.test(s)) return 'FN America'

  // Allison Transmission
  if (/allison\s+transmission/i.test(s)) return 'Allison Transmission'

  // Beechcraft / Hawker Beechcraft / Beechcraft Defense
  if (/hawker\s+beechcraft|beechcraft/i.test(s)) return 'Beechcraft Defense'

  // ViaSat / Viasat
  if (/viasat/i.test(s)) return 'Viasat Inc.'

  // VSE Corporation (sometimes bare "VSE", or prose after the name)
  if (/\bvse\b/i.test(s)) return 'VSE Corporation'

  // Kongsberg (incl. OCR typo "Konsberg")
  if (/kongsberg|konsberg/i.test(s)) return 'Kongsberg Defence & Aerospace'

  // Saab (often all-caps SAAB in older notices)
  if (/\bsaab\b/i.test(s)) return 'Saab AB'

  // US Ordnance (sometimes listed with plant location, e.g. McCarran, NV)
  if (/us\s*ordnance/i.test(s)) return 'US Ordnance'

  // American Ordnance (distinct from US Ordnance; notices sometimes misspell Ordinance)
  if (/american\s+ordinan[cs]e/i.test(s)) return 'American Ordnance'

  // Goodrich (incl. CT Goodrich ISR Systems — later UTC/Collins lineage)
  if (/goodrich/i.test(s)) return 'Goodrich Corporation'

  // DynCorp International (notices often say DynCorps)
  if (/dyncorp/i.test(s)) return 'DynCorp International'

  // Colt
  if (/\bcolt\b/i.test(s)) return "Colt's Manufacturing"

  // Dillon Aero
  if (/dillon/i.test(s)) return 'Dillon Aero'

  // Kaman
  if (/\bkaman\b/i.test(s)) return 'Kaman'

  // Selex (Leonardo UK / Selex ES)
  if (/selex/i.test(s)) return 'Selex ES'

  // Seiler Instrument (OCR: "Seile r Instrument")
  if (/seile\s*r\s+instrument|seiler\s+instrument/i.test(s)) return 'Seiler Instrument'

  // ARINC
  if (/\barinc\b/i.test(s)) return 'ARINC'

  // AgustaWestland
  if (/agustawestland|agusta\s*westland/i.test(s)) return 'AgustaWestland'

  // Repkon
  if (/repkon/i.test(s)) return 'Repkon USA'

  // Marvin Group (notices say Marvin Engineering / Marvin Industries)
  if (/marvin/i.test(s)) return 'Marvin Group'

  // Kratos Defense & Security Solutions
  if (/kratos/i.test(s)) return 'Kratos Defense & Security Solutions'

  // Hellfire Systems LLC (Lockheed Martin / Boeing JV for Hellfire missiles)
  if (/hellfire\s+(systems\s+)?(limited\s+liability|llc)/i.test(s) || /^hellfire\s+limited/i.test(s)) {
    return 'Hellfire Systems LLC'
  }

  // Longbow LLC (Lockheed Martin / Northrop Grumman JV for Apache fire-control radar)
  if (/longbow\s+(limited\s+liability|llc)/i.test(s)) return 'Longbow LLC'

  // Leidos
  if (/leidos/i.test(s)) return 'Leidos'

  // Booz Allen Hamilton
  if (/booz\s*allen/i.test(s)) return 'Booz Allen Hamilton'

  // Vinnell Arabia (notices sometimes spell Vinell)
  if (/vin+ell/i.test(s)) return 'Vinnell Arabia'

  // Navistar
  if (/navistar/i.test(s)) return 'Navistar Defense'

  // FLIR
  if (/\bflir\b/i.test(s)) return 'FLIR Systems'

  // Maxar
  if (/maxar/i.test(s)) return 'Maxar Technologies'

  // Moog
  if (/\bmoog\b/i.test(s)) return 'Moog Inc.'

  // Draper
  if (/draper/i.test(s)) return 'Draper Laboratory'

  // KBR
  if (/\bkbr\b/i.test(s)) return 'KBR Inc.'

  // V2X / Vectrus
  if (/\bv2x\b|vectrus/i.test(s)) return 'V2X Inc.'

  // SAIC
  if (/\bsaic\b/i.test(s)) return 'SAIC'

  // Thales
  if (/thales/i.test(s)) return 'Thales Group'

  // Airbus
  if (/airbus/i.test(s)) return 'Airbus'

  // Elbit
  if (/elbit/i.test(s)) return 'Elbit Systems'

  // Zone 5 / CoAspire already tend to be full in data
  if (/zone\s*5/i.test(s)) return 'Zone 5 Technologies'
  if (/coaspire/i.test(s)) return 'CoAspire'

  // Progeny Systems (GD Mission Systems business area)
  if (/progeny/i.test(s)) return 'Progeny Systems'

  // ── Generic cleanup for everything else ─────────────────────────────────────
  // Remove parenthetical asides: "(GEAC)", "(United Technologies)", etc.
  s = s.replace(/\s*\([^)]*\)/g, '').trim()
  // Remove location suffixes: "in [City]", "of [City]"
  s = s.replace(/\s+(?:in|of)\s+\w[\w\s,]*$/i, '').trim()
  // Remove trailing corporate designations (require whitespace so "ARINC" ≠ "… Inc")
  s = s.replace(/\s+(Corporation|Corp\.?|Incorporated|Inc\.?|LLC|Ltd\.?|Company|Co\.)$/i, '').trim()
  // Trailing punctuation leftovers from list parsing
  s = s.replace(/[,;.\s]+$/g, '').trim()

  return s || raw.trim()
}
