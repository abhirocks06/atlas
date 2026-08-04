import type { WeaponCategory } from '../utils/weaponCategories'

interface Props {
  category: WeaponCategory
  size?: number
  color?: string
}

export function CategoryIcon({ category, size = 13, color = 'currentColor' }: Props) {
  switch (category) {
    case 'Aircraft':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.5L8.55 5.2L14 7.5L8.55 6.85V10.2L11.4 12.8H8.7L8 14.5L7.3 12.8H4.6L7.45 10.2V6.85L2 7.5L7.45 5.2L8 1.5Z"
            fill={color}
            fillOpacity="0.92"
          />
        </svg>
      )
    case 'Missiles & Munitions':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 2L9.5 4.5v7L8 14l-1.5-2.5v-7L8 2Z" fill={color} opacity="0.9"/>
          <path d="M6.5 4.5L4 6v1.5l2.5.5M9.5 4.5L12 6v1.5L9.5 8" fill={color} opacity="0.6"/>
          <circle cx="8" cy="3" r="1" fill={color}/>
        </svg>
      )
    case 'Ground Vehicles & Artillery':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <rect x="2" y="7" width="12" height="5" rx="1" fill={color} opacity="0.8"/>
          <rect x="4" y="5" width="7" height="3" rx="0.5" fill={color} opacity="0.9"/>
          <circle cx="4.5" cy="12.5" r="1.5" fill={color}/>
          <circle cx="11.5" cy="12.5" r="1.5" fill={color}/>
          <path d="M11 5.5h2.5l1 2" stroke={color} strokeWidth="1" strokeLinecap="round"/>
        </svg>
      )
    case 'Naval Systems':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M2 10l1.5-4h9L14 10H2Z" fill={color} opacity="0.8"/>
          <path d="M5 6V4h4v2" fill={color} opacity="0.9"/>
          <path d="M7 4V2" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M1 10.5c1.5 1.5 3 2 5.5 1.5S12 11 15 11.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7"/>
        </svg>
      )
    case 'Electronics & Communications':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2" fill={color}/>
          <path d="M5 5a4.24 4.24 0 0 0 0 6M11 5a4.24 4.24 0 0 1 0 6" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none"/>
          <path d="M3 3a7.07 7.07 0 0 0 0 10M13 3a7.07 7.07 0 0 1 0 10" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.5"/>
        </svg>
      )
    case 'Sustainment & Support':
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <path d="M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Z" stroke={color} strokeWidth="1.2" fill="none" opacity="0.5"/>
          <path d="M8 5v3l2 2" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5 2.5C3.5 3.5 2.5 5 2.5 6.5" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
        </svg>
      )
    case 'Other':
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="5.5" stroke={color} strokeWidth="1.2" fill="none" opacity="0.6"/>
          <circle cx="8" cy="8" r="1.5" fill={color} opacity="0.7"/>
        </svg>
      )
  }
}
