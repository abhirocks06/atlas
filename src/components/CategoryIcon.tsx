import {
  CircleDot,
  Plane,
  Radio,
  Rocket,
  Ship,
  Truck,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import type { WeaponCategory } from '../utils/weaponCategories'

interface Props {
  category: WeaponCategory
  size?: number
  color?: string
}

const ICONS: Record<WeaponCategory, LucideIcon> = {
  Aircraft: Plane,
  'Missiles & Munitions': Rocket,
  'Ground Vehicles & Artillery': Truck,
  'Naval Systems': Ship,
  'Electronics & Communications': Radio,
  'Sustainment & Support': Wrench,
  Other: CircleDot,
}

export function CategoryIcon({ category, size = 13, color = 'currentColor' }: Props) {
  const Icon = ICONS[category] ?? CircleDot
  return (
    <Icon
      size={size}
      color={color}
      strokeWidth={size >= 48 ? 1.25 : 1.75}
      aria-hidden
    />
  )
}
