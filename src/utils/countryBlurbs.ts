import blurbs from '../../data/country_blurbs.json'

type BlurbEntry = {
  blurb: string
  source?: string
  updatedAt?: string
}

const map = blurbs as Record<string, BlurbEntry>

export function getCountryBlurb(country: string): string | null {
  return map[country]?.blurb ?? null
}
