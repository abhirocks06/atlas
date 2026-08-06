/** Curated equipment families for analytics / network grouping. */

export interface SystemFamily {
  /** URL / lookup id, e.g. "f-15" */
  id: string
  /** Official-style display name */
  label: string
  match: RegExp
}

/**
 * Equipment families — most-specific first.
 * Labels use formal / designation-style names for Network & Analytics.
 */
export const SYSTEM_FAMILIES: SystemFamily[] = [
  { id: 'growler', label: 'EA-18G Growler', match: /growler|ea-?\s*18/i },
  { id: 'super-hornet', label: 'F/A-18E/F Super Hornet', match: /super\s*hornet|f\/?a?-?\s*18[ef]|fa-?\s*18[ef]/i },
  { id: 'hornet', label: 'F/A-18 Hornet', match: /f\/?a?-?\s*18|fa-?\s*18|f-?\s*18/i },
  { id: 'f-35', label: 'F-35 Lightning II', match: /f-?\s*35|lightning\s*ii|joint\s*strike\s*fighter/i },
  { id: 'f-15', label: 'F-15 Eagle', match: /f[-\s]*15|silent\s*eagle|peace\s*carvin|strike\s*eagle/i },
  { id: 'f-16', label: 'F-16 Fighting Falcon', match: /f-?\s*16|fighting\s*falcon|kf-?\s*16/i },
  { id: 'e-7', label: 'E-7 Wedgetail', match: /\be-?\s*7\b|wedgetail/i },
  { id: 'e-2', label: 'E-2 Hawkeye', match: /\be-?\s*2\b|hawkeye/i },
  { id: 'e-3', label: 'E-3 Sentry AWACS', match: /\be-?\s*3\b|awacs|\bsentry\b/i },
  { id: 'p-8', label: 'P-8A Poseidon', match: /p-?\s*8|poseidon/i },
  { id: 'c-17', label: 'C-17 Globemaster III', match: /c-?\s*17|globemaster/i },
  { id: 'kc-130', label: 'KC-130J Super Hercules', match: /kc-?\s*130/i },
  { id: 'c-130', label: 'C-130 Hercules', match: /c-?\s*130|hercules/i },
  { id: 'kc-46', label: 'KC-46A Pegasus', match: /kc-?\s*46/i },
  { id: 'mq-9', label: 'MQ-9 Reaper', match: /mq-?\s*9|reaper|skyguardian|predator/i },
  { id: 'mq-4', label: 'MQ-4C Triton', match: /mq-?\s*4|triton/i },
  { id: 'global-hawk', label: 'RQ-4 Global Hawk', match: /global\s*hawk|rq-?\s*4/i },
  { id: 'apache', label: 'AH-64 Apache', match: /ah-?\s*64|apache/i },
  { id: 'cobra', label: 'AH-1Z Viper', match: /ah-?\s*1[wz]?|super\s*cobra|\bcobra\b.*helicopter/i },
  { id: 'black-hawk', label: 'UH-60 Black Hawk', match: /uh-?\s*60|hh-?\s*60|black\s*hawk/i },
  { id: 'seahawk', label: 'MH-60R Seahawk', match: /mh-?\s*60|seahawk|sh-?\s*60/i },
  { id: 'chinook', label: 'CH-47 Chinook', match: /ch-?\s*47|chinook/i },
  { id: 'osprey', label: 'V-22 Osprey', match: /v-?\s*22|osprey|mv-?\s*22/i },
  { id: 'ch-53', label: 'CH-53K King Stallion', match: /ch-?\s*53|super\s*stallion|king\s*stallion/i },
  { id: 'patriot', label: 'Patriot Air Defense System', match: /patriot|pac-?\s*3|mim-?\s*104/i },
  { id: 'thaad', label: 'THAAD Missile Defense', match: /thaad|terminal\s*high\s*altitude/i },
  { id: 'nasams', label: 'NASAMS Air Defense', match: /nasams|national\s*advanced\s*surface/i },
  { id: 'himars', label: 'M142 HIMARS', match: /himars|m142|gmlrs|guided\s*multiple\s*launch|atacms|army\s*tactical\s*missile/i },
  { id: 'javelin', label: 'FGM-148 Javelin', match: /javelin|fgm-?\s*148/i },
  { id: 'stinger', label: 'FIM-92 Stinger', match: /stinger|fim-?\s*92/i },
  { id: 'tow', label: 'BGM-71 TOW', match: /\btow\b|tube[- ]launched\s*optically/i },
  { id: 'hellfire', label: 'AGM-114 Hellfire', match: /hellfire|agm-?\s*114/i },
  { id: 'jagm', label: 'AGM-179 JAGM', match: /\bjagm\b|joint\s*air-to-ground\s*missile/i },
  { id: 'amraam', label: 'AIM-120 AMRAAM', match: /amraam|aim-?\s*120|advanced\s*medium[- ]?range\s*air-to-air/i },
  { id: 'sidewinder', label: 'AIM-9X Sidewinder', match: /sidewinder|aim-?\s*9/i },
  { id: 'jdam', label: 'GBU JDAM', match: /jdam|joint\s*direct\s*attack/i },
  { id: 'sdb', label: 'GBU-39 Small Diameter Bomb', match: /gbu-?\s*39|gbu-?\s*53|small\s*diameter\s*bomb|\bsdb\b|storm.?breaker/i },
  { id: 'jassm', label: 'AGM-158 JASSM', match: /jassm|agm-?\s*158|lrasm|joint\s*air-to-surface\s*standoff|long\s*range\s*anti-ship/i },
  { id: 'jsow', label: 'AGM-154 JSOW', match: /jsow|joint\s*stand[- ]?off\s*weapon/i },
  { id: 'harpoon', label: 'AGM-84 Harpoon', match: /harpoon|agm-?\s*84|ugm-?\s*84|rgm-?\s*84/i },
  { id: 'tomahawk', label: 'BGM-109 Tomahawk', match: /tomahawk|bgm-?\s*109|\btlam\b/i },
  { id: 'sm-6', label: 'RIM-174 SM-6', match: /\bsm-?\s*6\b|rim-?\s*174|standard\s*missile[-\s(]*6/i },
  { id: 'sm-3', label: 'RIM-161 SM-3', match: /\bsm-?\s*3\b|rim-?\s*161|standard\s*missile[-\s(]*3/i },
  { id: 'sm-2', label: 'RIM-66/67 SM-2', match: /\bsm-?\s*2\b|rim-?\s*66|rim-?\s*67|standard\s*missile/i },
  { id: 'essm', label: 'RIM-162 ESSM', match: /essm|seasparrow|sea\s*sparrow/i },
  { id: 'ram', label: 'RIM-116 RAM', match: /\bram\b.*missile|rolling\s*airframe/i },
  { id: 'mk54', label: 'MK 54 Torpedo', match: /mk\.?\s*54|lightweight\s*torpedo/i },
  { id: 'mk48', label: 'MK 48 Torpedo', match: /mk\.?\s*48/i },
  { id: 'abrams', label: 'M1 Abrams Tank', match: /abrams|m1a[12]/i },
  { id: 'stryker', label: 'Stryker Combat Vehicle', match: /stryker/i },
  { id: 'jltv', label: 'Joint Light Tactical Vehicle', match: /jltv|joint\s*light\s*tactical/i },
  { id: 'hmmwv', label: 'HMMWV', match: /hmmwv|high\s*mobility\s*multi[- ]?purpose/i },
  { id: 'mrap', label: 'MRAP Vehicle', match: /\bmrap\b|mine\s*resistant\s*ambush/i },
  { id: 'lav', label: 'Light Armored Vehicle', match: /light\s*armored\s*vehicle|\blav\b/i },
  { id: 'aav', label: 'Assault Amphibious Vehicle', match: /assault\s*amphibious|\baav\b/i },
  { id: 'm777', label: 'M777 Howitzer', match: /m777/i },
  { id: 'aegis', label: 'Aegis Combat System', match: /\baegis\b/i },
  { id: 'ibcs', label: 'IBCS Battle Command', match: /\bibcs\b|integrated\s*air\s*and\s*missile\s*defense.*battle\s*command/i },
  { id: 'laircm', label: 'AN/AAQ-24 LAIRCM', match: /laircm|large\s*aircraft\s*infrared/i },
  { id: 'apkws', label: 'APKWS Guided Rocket', match: /apkws|precision\s*kill\s*weapon/i },
  { id: 'excalibur', label: 'M982 Excalibur', match: /excalibur|m982/i },
  { id: 'phalanx', label: 'Phalanx CIWS', match: /phalanx|ciws|mk\.?\s*15/i },
  { id: 'cbu-105', label: 'CBU-105 Sensor Fuzed Weapon', match: /cbu-?\s*105|sensor\s*fuzed/i },
  { id: 'sniper-atp', label: 'Sniper Advanced Targeting Pod', match: /sniper\s*advanced\s*targeting|\bsniper\s*atp\b/i },
  { id: 'nsm', label: 'Naval Strike Missile', match: /naval\s*strike\s*missile|\bnsm\b/i },
  { id: 't-6', label: 'T-6A Texan II', match: /\bt-?\s*6[ab]?\b|texan\s*ii?/i },
  { id: 'uh-72', label: 'UH-72 Lakota', match: /uh-?\s*72|lakota/i },
  { id: 'bell-412', label: 'Bell 412', match: /bell\s*412/i },
  { id: 'c-27j', label: 'C-27J Spartan', match: /c-?\s*27j?/i },
  { id: 'g550', label: 'Gulfstream G550', match: /gulfstream\s*g?550|g550/i },
  // Services — keep before catch-alls
  { id: 'blanket-order-training', label: 'Blanket Order Training', match: /blanket\s+order\s+training/i },
  { id: 'blanket-order', label: 'Blanket Order Support', match: /blanket\s+order/i },
  { id: 'fmso', label: 'FMSO / CLSSA Support', match: /\bfmso\b|clssa|cooperative\s*logistics\s*supply/i },
]

const familyById = new Map(SYSTEM_FAMILIES.map(f => [f.id, f]))

export function getSystemFamily(system: string | null | undefined): SystemFamily | null {
  if (!system?.trim()) return null
  for (const f of SYSTEM_FAMILIES) {
    if (f.match.test(system)) return f
  }
  return null
}

export function getSystemFamilyById(id: string | null | undefined): SystemFamily | null {
  if (!id) return null
  return familyById.get(id) ?? null
}

/** Family id for a system title, or null if unmatched. */
export function equipmentIdForSystem(system: string | null | undefined): string | null {
  if (!system?.trim()) return null
  return getSystemFamily(system)?.id ?? null
}

/** Resolve a family id to its display label. */
export function resolveEquipment(
  id: string | null | undefined,
): { id: string; label: string } | null {
  if (!id) return null
  const fam = getSystemFamilyById(id)
  if (!fam) return null
  return { id: fam.id, label: fam.label }
}
