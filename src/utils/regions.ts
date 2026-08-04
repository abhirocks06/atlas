export type Region =
  | 'Europe'
  | 'Middle East & N. Africa'
  | 'Indo-Pacific'
  | 'Americas'
  | 'Sub-Saharan Africa'
  | 'Other'

export const ALL_REGIONS: Region[] = [
  'Europe',
  'Middle East & N. Africa',
  'Indo-Pacific',
  'Americas',
  'Sub-Saharan Africa',
  'Other',
]

export const REGION_COLORS: Record<Region, string> = {
  Europe: '#4a7ab5',
  'Middle East & N. Africa': '#c4873a',
  'Indo-Pacific': '#2e7d9b',
  Americas: '#5a8a5a',
  'Sub-Saharan Africa': '#8a6a5a',
  Other: '#3a4050',
}

const REGION_BY_COUNTRY: Record<string, Region> = {
  // Europe
  Austria: 'Europe',
  Belgium: 'Europe',
  'Bosnia and Herzegovina': 'Europe',
  Bulgaria: 'Europe',
  Croatia: 'Europe',
  'Czech Republic': 'Europe',
  Denmark: 'Europe',
  Estonia: 'Europe',
  Finland: 'Europe',
  France: 'Europe',
  Georgia: 'Europe',
  Germany: 'Europe',
  Greece: 'Europe',
  Hungary: 'Europe',
  Ireland: 'Europe',
  Italy: 'Europe',
  Kosovo: 'Europe',
  Latvia: 'Europe',
  Lithuania: 'Europe',
  Luxembourg: 'Europe',
  Montenegro: 'Europe',
  Netherlands: 'Europe',
  'North Macedonia': 'Europe',
  Norway: 'Europe',
  Poland: 'Europe',
  Portugal: 'Europe',
  Romania: 'Europe',
  Slovakia: 'Europe',
  Slovenia: 'Europe',
  Spain: 'Europe',
  Sweden: 'Europe',
  Switzerland: 'Europe',
  Ukraine: 'Europe',
  'United Kingdom': 'Europe',
  NATO: 'Europe',

  // Middle East & North Africa
  Bahrain: 'Middle East & N. Africa',
  Egypt: 'Middle East & N. Africa',
  Iraq: 'Middle East & N. Africa',
  Israel: 'Middle East & N. Africa',
  Jordan: 'Middle East & N. Africa',
  Kuwait: 'Middle East & N. Africa',
  Lebanon: 'Middle East & N. Africa',
  Libya: 'Middle East & N. Africa',
  Morocco: 'Middle East & N. Africa',
  Oman: 'Middle East & N. Africa',
  Qatar: 'Middle East & N. Africa',
  'Saudi Arabia': 'Middle East & N. Africa',
  Tunisia: 'Middle East & N. Africa',
  Turkey: 'Middle East & N. Africa',
  Türkiye: 'Middle East & N. Africa',
  'United Arab Emirates': 'Middle East & N. Africa',

  // Indo-Pacific
  Afghanistan: 'Indo-Pacific',
  Australia: 'Indo-Pacific',
  Bangladesh: 'Indo-Pacific',
  Brunei: 'Indo-Pacific',
  India: 'Indo-Pacific',
  Indonesia: 'Indo-Pacific',
  Japan: 'Indo-Pacific',
  Kazakhstan: 'Indo-Pacific',
  Malaysia: 'Indo-Pacific',
  'New Zealand': 'Indo-Pacific',
  Pakistan: 'Indo-Pacific',
  Philippines: 'Indo-Pacific',
  'Republic of Korea': 'Indo-Pacific',
  Singapore: 'Indo-Pacific',
  Taiwan: 'Indo-Pacific',
  Thailand: 'Indo-Pacific',
  Vietnam: 'Indo-Pacific',

  // Americas
  Argentina: 'Americas',
  Brazil: 'Americas',
  Canada: 'Americas',
  Chile: 'Americas',
  Colombia: 'Americas',
  Ecuador: 'Americas',
  Guyana: 'Americas',
  Mexico: 'Americas',
  Peru: 'Americas',
  'United States': 'Americas',
  Uruguay: 'Americas',

  // Sub-Saharan Africa
  Ghana: 'Sub-Saharan Africa',
  Kenya: 'Sub-Saharan Africa',
  Nigeria: 'Sub-Saharan Africa',
  Zambia: 'Sub-Saharan Africa',
}

export function regionForCountry(country: string | null): Region {
  if (!country) return 'Other'
  return REGION_BY_COUNTRY[country] ?? 'Other'
}
