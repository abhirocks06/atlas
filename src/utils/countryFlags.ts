const COUNTRY_CODES: Record<string, string> = {
  'Afghanistan': 'af',
  'Albania': 'al',
  'Argentina': 'ar',
  'Australia': 'au',
  'Austria': 'at',
  'Bahrain': 'bh',
  'Bangladesh': 'bd',
  'Belgium': 'be',
  'Bosnia and Herzegovina': 'ba',
  'Brazil': 'br',
  'Brunei': 'bn',
  'Bulgaria': 'bg',
  'Canada': 'ca',
  'Chile': 'cl',
  'Colombia': 'co',
  'Croatia': 'hr',
  'Czech Republic': 'cz',
  'Denmark': 'dk',
  'Ecuador': 'ec',
  'Egypt': 'eg',
  'Estonia': 'ee',
  'Finland': 'fi',
  'France': 'fr',
  'Georgia': 'ge',
  'Germany': 'de',
  'Ghana': 'gh',
  'Greece': 'gr',
  'Guyana': 'gy',
  'Hungary': 'hu',
  'India': 'in',
  'Indonesia': 'id',
  'Iraq': 'iq',
  'Ireland': 'ie',
  'Israel': 'il',
  'Italy': 'it',
  'Japan': 'jp',
  'Jordan': 'jo',
  'Kazakhstan': 'kz',
  'Kenya': 'ke',
  'Kosovo': 'xk',
  'Kuwait': 'kw',
  'Latvia': 'lv',
  'Lebanon': 'lb',
  'Libya': 'ly',
  'Luxembourg': 'lu',
  'Lithuania': 'lt',
  'Malaysia': 'my',
  'Mexico': 'mx',
  'Morocco': 'ma',
  'Montenegro': 'me',
  'NATO': 'nato',
  'Netherlands': 'nl',
  'New Zealand': 'nz',
  'Nigeria': 'ng',
  'North Macedonia': 'mk',
  'Norway': 'no',
  'Oman': 'om',
  'Pakistan': 'pk',
  'Peru': 'pe',
  'Philippines': 'ph',
  'Poland': 'pl',
  'Portugal': 'pt',
  'Qatar': 'qa',
  'Republic of Korea': 'kr',
  'Romania': 'ro',
  'Saudi Arabia': 'sa',
  'Singapore': 'sg',
  'Slovakia': 'sk',
  'Slovenia': 'si',
  'South Africa': 'za',
  'Spain': 'es',
  'Sweden': 'se',
  'Switzerland': 'ch',
  'Taiwan': 'tw',
  'Thailand': 'th',
  'Tunisia': 'tn',
  'Turkey': 'tr',
  'Türkiye': 'tr',
  'Ukraine': 'ua',
  'United Arab Emirates': 'ae',
  'United Kingdom': 'gb',
  'United States': 'us',
  'United States of America': 'us',
  'Uruguay': 'uy',
  'Vietnam': 'vn',
  'Zambia': 'zm',
}

export function getFlagUrl(country: string, width: 40 | 80 | 160 | 320 = 160): string | null {
  const code = COUNTRY_CODES[country]
  if (!code) return null
  // Local SVGs stay crisp at any size
  if (code === 'nato') return '/flags/nato.svg'
  // Prefer SVG from flagcdn — sharp on retina; PNG width kept for callers that need a raster
  if (width >= 160) return `https://flagcdn.com/${code}.svg`
  return `https://flagcdn.com/w${width}/${code}.png`
}

const warmed = new Set<string>()

/** Warm the browser cache so country-page flags appear instantly. */
export function prefetchFlag(country: string, width: 40 | 80 | 160 | 320 = 160): void {
  const url = getFlagUrl(country, width)
  if (!url || warmed.has(url)) return
  warmed.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}

export function prefetchFlags(countries: Iterable<string>, width: 40 | 80 | 160 | 320 = 160): void {
  for (const country of countries) prefetchFlag(country, width)
}
