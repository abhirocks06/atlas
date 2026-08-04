export type WeaponCategory =
  | 'Aircraft'
  | 'Missiles & Munitions'
  | 'Ground Vehicles & Artillery'
  | 'Naval Systems'
  | 'Electronics & Communications'
  | 'Sustainment & Support'
  | 'Other'

export const CATEGORY_COLORS: Record<WeaponCategory, string> = {
  'Aircraft':                     '#4a7ab5',
  'Missiles & Munitions':         '#c4873a',
  'Ground Vehicles & Artillery':  '#5a8a5a',
  'Naval Systems':                '#4a8a8a',
  'Electronics & Communications': '#8a5a8a',
  'Sustainment & Support':        '#6b7a8d',
  'Other':                        '#3a4050',
}

const RULES: Array<[WeaponCategory, RegExp]> = [
  // Naval before Aircraft so "F-100 Frigate" isn't treated as an F-series fighter
  ['Naval Systems', /ship|vessel|frigate|destroyer|submarine|littoral|coast.*guard|patrol.*boat|patrol craft|naval|maritime|sonar|torpedo.*launch|anti-ship|aegis|phalanx|CIWS|cutter|surface combatant|vertical launching|VLS|Archangel|boat/i],
  ['Aircraft', /helicopt|aircraft|F-\d+|AH-\d+|UH-\d+|CH-\d+|MH-\d+|P-\d+|C-\d+|KC-\d+|V-\d+|MQ-\d+|RQ-\d+|drone|UAV|UAS|UAS\b|Reaper|Predator|AWACS|Hornet|fixed.wing|rotary|airframe|turbine|engine|propeller|simulator.*flight|flight.*sim|aerostat|LAIRCM|ATFLIR/i],
  ['Missiles & Munitions', /missile|munition|rocket|bomb|JDAM|AMRAAM|AIM-|AGM-|GBU-|CBU-|JSOW|MK-\d+.*bomb|Javelin|Stinger|HIMARS|MLRS|APKWS|THAAD|Patriot|Tomahawk|Harpoon|Excalibur|projectile|IBCS|Integrated Battle Command|air.?defense|fire.?control|precision kill weapon|air.?strike|strike weapon|torpedo|warhead|guidance|fuze|propellant|ammunition|ammo|round|cartridge|grenade|mortar|ordnance|Volcano|ALTIUS|loitering|counter.?UAS|counter.?unmanned|ITAS|target acquisition/i],
  ['Ground Vehicles & Artillery', /tank|M1A|Abrams|vehicle|HMMWV|Humvee|truck|artillery|howitzer|cannon|M109|M777|armored|APC|Bradley|Stryker|JLTV|MRAP|gun system|launcher.*ground|ground.*launcher|bulldozer|Caterpillar/i],
  ['Electronics & Communications', /radar|sensor|radio|communication|satellite|command.*control|C2|C4I|electronic|cyber|network|software|data.*link|LINK.?16|MIDS|Multifunctional Information Distribution|navigation|GPS|IFF|transponder|countermeasure|EW |electronic.*warfare|infrared.*system|targeting.*pod|surveillance|ISR|reconnaissance|recce|night.?vision|traffic.?control|landing.?system|terminal|oceanographic|repeater|border.?security|Mobile User Objective/i],
  ['Sustainment & Support', /sustainment|support|spare|maintenance|training|logistics|overhaul|depot|service|upgrade|modification|technical.*assist|follow-on|replenishment|equipment.*support|FMSO|modernization program|headquarters|medical information/i],
]

export function categorize(system: string | null): WeaponCategory {
  if (!system) return 'Other'
  for (const [cat, re] of RULES) {
    if (re.test(system)) return cat
  }
  return 'Other'
}

export const ALL_CATEGORIES: WeaponCategory[] = [
  'Aircraft',
  'Missiles & Munitions',
  'Ground Vehicles & Artillery',
  'Naval Systems',
  'Electronics & Communications',
  'Sustainment & Support',
  'Other',
]
