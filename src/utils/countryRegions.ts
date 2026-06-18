export type Region =
  | 'Middle East & North Africa'
  | 'Europe'
  | 'Indo-Pacific'
  | 'Americas'
  | 'Africa'
  | 'Central & South Asia'

export const ALL_REGIONS: Region[] = [
  'Middle East & North Africa',
  'Europe',
  'Indo-Pacific',
  'Americas',
  'Africa',
  'Central & South Asia',
]

const COUNTRY_REGION: Record<string, Region> = {
  // Middle East & N. Africa
  'Bahrain': 'Middle East & North Africa',
  'Egypt': 'Middle East & North Africa',
  'Iraq': 'Middle East & North Africa',
  'Iraq F': 'Middle East & North Africa',
  'Israel': 'Middle East & North Africa',
  'Jordan': 'Middle East & North Africa',
  'Kuwait': 'Middle East & North Africa',
  'Kuwait C': 'Middle East & North Africa',
  'Lebanon': 'Middle East & North Africa',
  'Libya': 'Middle East & North Africa',
  'Morocco': 'Middle East & North Africa',
  'Oman': 'Middle East & North Africa',
  'Qatar': 'Middle East & North Africa',
  'Qatar- Rim': 'Middle East & North Africa',
  'Saudi Arabia': 'Middle East & North Africa',
  'Tunisia': 'Middle East & North Africa',
  'United Arab Emirates': 'Middle East & North Africa',

  // Europe (incl. NATO, Turkey as NATO member, Ukraine)
  'Austria': 'Europe',
  'Belgium': 'Europe',
  'Bulgaria': 'Europe',
  'Croatia': 'Europe',
  'Czech Republic': 'Europe',
  'Denmark': 'Europe',
  'Estonia': 'Europe',
  'Finland': 'Europe',
  'France': 'Europe',
  'Germany': 'Europe',
  'Greece': 'Europe',
  'Hungary': 'Europe',
  'Ireland': 'Europe',
  'Italy': 'Europe',
  'Kosovo': 'Europe',
  'Latvia': 'Europe',
  'Lithuania': 'Europe',
  'NATO': 'Europe',
  'Nato': 'Europe',
  'Netherlands': 'Europe',
  'North Macedonia': 'Europe',
  'Norway': 'Europe',
  'Norway Aim': 'Europe',
  'Poland': 'Europe',
  'Romania': 'Europe',
  'Slovakia': 'Europe',
  'Spain': 'Europe',
  'Sweden': 'Europe',
  'Switzerland': 'Europe',
  'Turkey': 'Europe',
  'Türkiye': 'Europe',
  'Ukraine': 'Europe',
  'United Kingdom': 'Europe',

  // Indo-Pacific
  'Australia': 'Indo-Pacific',
  'Bangladesh': 'Indo-Pacific',
  'Brunei': 'Indo-Pacific',
  'India': 'Indo-Pacific',
  'Indonesia': 'Indo-Pacific',
  'Japan': 'Indo-Pacific',
  'Malaysia': 'Indo-Pacific',
  'New Zealand': 'Indo-Pacific',
  'Philippines': 'Indo-Pacific',
  'Republic of Korea': 'Indo-Pacific',
  'Singapore': 'Indo-Pacific',
  'Taiwan': 'Indo-Pacific',
  'Thailand': 'Indo-Pacific',
  'Thailand- Uh': 'Indo-Pacific',
  'Vietnam': 'Indo-Pacific',

  // Americas
  'Argentina': 'Americas',
  'Brazil': 'Americas',
  'Canada': 'Americas',
  'Chile': 'Americas',
  'Colombia': 'Americas',
  'Ecuador': 'Americas',
  'Guyana': 'Americas',
  'Mexico': 'Americas',
  'Peru': 'Americas',

  // Africa (sub-Saharan)
  'Ghana': 'Africa',
  'Nigeria': 'Africa',
  'Zambia': 'Africa',

  // Central & South Asia
  'Afghanistan': 'Central & South Asia',
  'Georgia': 'Central & South Asia',
  'Pakistan': 'Central & South Asia',
}

export function getRegion(country: string): Region | null {
  return COUNTRY_REGION[country] ?? null
}
