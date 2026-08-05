import { categorize, CATEGORY_COLORS, type WeaponCategory } from './weaponCategories'
import systemImages from '../data/system_images.json'

export interface SystemVisual {
  category: WeaponCategory
  color: string
  imageUrl: string | null
  imageCredit: string | null
  atmosphere: string
  /** One-line explanation of what the system does */
  blurb: string
}

const CATEGORY_ATMOSPHERE: Record<WeaponCategory, string> = {
  'Aircraft':
    'radial-gradient(ellipse at 20% 0%, #4a7ab555 0%, transparent 50%), linear-gradient(160deg, #0a1524 0%, #132338 45%, #0b0e16 100%)',
  'Missiles & Munitions':
    'radial-gradient(ellipse at 80% 10%, #c4873a44 0%, transparent 45%), linear-gradient(160deg, #1a1208 0%, #2a1c10 45%, #0b0e16 100%)',
  'Ground Vehicles & Artillery':
    'radial-gradient(ellipse at 15% 80%, #5a8a5a44 0%, transparent 50%), linear-gradient(160deg, #0c140c 0%, #162016 45%, #0b0e16 100%)',
  'Naval Systems':
    'radial-gradient(ellipse at 70% 30%, #4a8a8a44 0%, transparent 50%), linear-gradient(160deg, #071418 0%, #0e2428 45%, #0b0e16 100%)',
  'Electronics & Communications':
    'radial-gradient(ellipse at 50% 0%, #8a5a8a44 0%, transparent 50%), linear-gradient(160deg, #140c18 0%, #221628 45%, #0b0e16 100%)',
  'Sustainment & Support':
    'radial-gradient(ellipse at 30% 20%, #6b7a8d44 0%, transparent 50%), linear-gradient(160deg, #0e1014 0%, #181c24 45%, #0b0e16 100%)',
  'Other':
    'radial-gradient(ellipse at 40% 10%, #3a405044 0%, transparent 50%), linear-gradient(160deg, #0c0c10 0%, #161820 45%, #0b0e16 100%)',
}

const CATEGORY_BLURB: Record<WeaponCategory, string> = {
  'Aircraft': 'Manned or remotely piloted air platforms for strike, lift, tanker, surveillance, or training missions.',
  'Missiles & Munitions': 'Precision and area weapons used to engage air, ground, or maritime targets.',
  'Ground Vehicles & Artillery': 'Armored mobility and fire-support systems for land forces.',
  'Naval Systems': 'Surface and undersea combat systems for fleet air defense, strike, and seabed warfare.',
  'Electronics & Communications': 'Sensors, radios, EW, and command links that find, track, and share targets.',
  'Sustainment & Support': 'Parts, training, fuel, and services that keep fleets and stocks mission-ready.',
  'Other': 'Defense articles and services transferred through the Foreign Military Sales process.',
}

interface SystemProfile {
  match: RegExp
  blurb: string
  url?: string
  credit?: string
}

interface ImageCatalogEntry {
  pattern: string
  url: string
  title?: string
  query?: string
}

/** Profiles ordered most-specific first. Local assets and blurbs live here. */
const SYSTEM_PROFILES: SystemProfile[] = [
  {
    match: /iadws|integrated air defense weapon|integrated air defense system/i,
    blurb: 'Layered air-defense package that combines sensors and interceptors to defeat aircraft, drones, and cruise missiles.',
    url: '/system-images/patriot-launch.jpg',
  },
  {
    match: /ibcs|battle command system|integrated battle command/i,
    blurb: 'Networked air-and-missile-defense command system that links sensors and shooters across the battlespace.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Patriot_missile_radar_-_LTAMDS_-_Lower_Tier_Air_and_Missile_Defense_Sensor_%282%29.webp/960px-Patriot_missile_radar_-_LTAMDS_-_Lower_Tier_Air_and_Missile_Defense_Sensor_%282%29.webp.png',
  },
  {
    match: /ltamds|lower tier air and missile defense sensor/i,
    blurb: '360-degree AESA radar that feeds Patriot and IBCS batteries with air and missile tracks.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Patriot_missile_radar_-_LTAMDS_-_Lower_Tier_Air_and_Missile_Defense_Sensor_%282%29.webp/960px-Patriot_missile_radar_-_LTAMDS_-_Lower_Tier_Air_and_Missile_Defense_Sensor_%282%29.webp.png',
  },
  {
    match: /mk[-\s]?45|mark[-\s]?45/i,
    blurb: 'Naval gun system for surface fire support and ship self-defense against surface and air threats.',
    url: '/system-images/mk45-gun-system.png',
  },
  {
    match: /76\s*mm\s*naval\s*gun|oto\s*melara\s*76/i,
    blurb: 'Medium-caliber naval gun for anti-surface, anti-air, and shore bombardment from warships and patrol craft.',
    url: '/system-images/76mm-naval-gun.png',
  },
  {
    match: /hellfire|agm-114/i,
    blurb: 'Laser- or radar-guided air-to-ground missile for precision strikes from helicopters, aircraft, and drones.',
  },
  {
    match: /apkws|precision kill weapon/i,
    blurb: 'Guidance kit that turns unguided Hydra-70 rockets into laser-guided precision munitions.',
  },
  {
    match: /javelin|fgm-148/i,
    blurb: 'Man-portable fire-and-forget anti-armor missile designed to defeat tanks from above.',
  },
  {
    match: /stinger|fim-92/i,
    blurb: 'Shoulder-fired infrared-homing missile for short-range defense against aircraft and drones.',
  },
  {
    match: /aim-120c-8|120c-8/i,
    blurb: 'Latest AMRAAM variant with improved range and seeker performance for beyond-visual-range air combat.',
    url: '/system-images/aim-120c-8.png',
  },
  {
    match: /amraam|aim-120|advanced medium[- ]?range air-to-air/i,
    blurb: 'Beyond-visual-range air-to-air missile that lets fighters engage airborne threats before closing in.',
    url: '/system-images/aim-120c-8.png',
  },
  {
    match: /\bjagm\b|joint air-to-ground missile/i,
    blurb: 'Air-launched precision missile that replaces Hellfire for attacking armor and hardened targets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/4b/AGM-179_JAGM.png',
  },
  {
    match: /aim-9x|sidewinder.*9x|9x.*sidewinder/i,
    blurb: 'Fifth-generation short-range infrared air-to-air missile with high off-boresight targeting and thrust-vector control.',
    url: '/system-images/aim-9x-sidewinder.png',
  },
  {
    match: /sidewinder|aim-9/i,
    blurb: 'Short-range infrared air-to-air missile for close-in dogfight and self-defense engagements.',
  },
  {
    match: /patriot|pac-3|mim-104/i,
    blurb: 'Mobile surface-to-air system that intercepts aircraft, cruise missiles, and ballistic threats.',
    url: '/system-images/patriot-launch.jpg',
  },
  {
    match: /thaad|terminal high altitude/i,
    blurb: 'Upper-tier missile shield that destroys ballistic missiles outside the dense atmosphere.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg/960px-The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg',
  },
  {
    match: /nasams|national advanced surface/i,
    blurb: 'Networked surface-to-air system that uses AMRAAM-class missiles to defend airspace and critical sites.',
  },
  {
    match: /common fire control|\bcfcs\b|universal fire control/i,
    blurb: 'Fire-control software and hardware that aims and fires rocket artillery such as HIMARS and MLRS.',
    url: '/system-images/common-fire-control.jpg',
  },
  {
    match: /sniper\s*(advanced\s*)?targeting|aaq-?33|\batp\b.*sniper|sniper\s*pod/i,
    blurb: 'Electro-optical targeting pod that finds, tracks, and laser-designates ground targets for precision strike.',
    url: '/system-images/sniper-atp.jpg',
  },
  {
    match: /himars|m142|high mobility artillery rocket|gmlrs|guided multiple launch|atacms|army tactical missile/i,
    blurb: 'Wheeled rocket artillery that fires guided rockets and long-range missiles against land targets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/180614-A-IY962-102_-_M142_High_Mobility_Artillery_Rocket_System_%28HIMARS%29_firing_during_Saber_Strike_18_%28Image_4_of_7%29.jpg/960px-180614-A-IY962-102_-_M142_High_Mobility_Artillery_Rocket_System_%28HIMARS%29_firing_during_Saber_Strike_18_%28Image_4_of_7%29.jpg',
  },
  {
    match: /multiple launch rocket|\bm270\b|\bmlrs\b/i,
    blurb: 'Tracked rocket artillery that fires guided rockets and tactical missiles from a mobile launcher.',
  },
  {
    match: /jassm|agm-158|joint air-to-surface standoff|standoff missile|lrasm|long range anti-ship/i,
    blurb: 'Stealthy air-launched cruise missile for striking hardened, defended, or maritime targets from long range.',
  },
  {
    match: /jdam|joint direct attack/i,
    blurb: 'GPS/INS tail kit that converts gravity bombs into all-weather precision-guided munitions.',
    url: '/system-images/jdam.jpg',
  },
  {
    match: /cbu-?105|sensor\s*fuzed|sensor\s*fused|\bsfw\b/i,
    blurb: 'Wind-corrected cluster munition that dispenses sensor-fuzed submunitions against armored vehicles.',
    url: '/system-images/cbu-105-sfw.jpg',
    credit: 'Texcoco / Wikimedia Commons',
  },
  {
    match: /air\s*strike\s*weapons/i,
    blurb: 'Package of air-delivered precision munitions such as Small Diameter Bombs and JDAM guidance kits.',
    url: '/system-images/air-strike-weapons.jpg',
  },
  {
    match: /t55[- ]?ga[- ]?714|t-?55[- ]?ga[- ]?714/i,
    blurb: 'Turboshaft engine that powers CH-47 Chinook heavy-lift helicopters.',
    url: '/system-images/t55-ga-714a.jpg',
    credit: 'Mr.Z-man / Wikimedia Commons',
  },
  {
    match: /gbu-?39|small diameter bomb|\bsdb\b|gbu-?53|storm.?breaker|sdb-?ii/i,
    blurb: 'Compact precision glide bombs that let fighters hit multiple targets from standoff range.',
  },
  {
    match: /excalibur|m982/i,
    blurb: 'GPS-guided 155 mm artillery projectile for precise fire support against fixed ground targets.',
  },
  {
    match: /aargm|agm-88|harm\b|anti-radiation guided/i,
    blurb: 'Anti-radiation missile that homes on enemy air-defense radars to suppress or destroy them.',
  },
  {
    match: /harpoon|agm-84|ugm-84/i,
    blurb: 'Anti-ship cruise missile for engaging surface vessels from aircraft, ships, or submarines.',
  },
  {
    match: /tomahawk|bgm-109|tlam/i,
    blurb: 'Long-range land-attack cruise missile launched from ships and submarines against fixed targets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Tomahawk_Land_Attack_Missile_%28_Cruise_Missile%29_%28TLAM%29_flying_through_the_air._12-04-2000_MOD_45138116.jpg/960px-Tomahawk_Land_Attack_Missile_%28_Cruise_Missile%29_%28TLAM%29_flying_through_the_air._12-04-2000_MOD_45138116.jpg',
    credit: 'UK MoD / Wikimedia Commons',
  },
  {
    match: /essm|seasparrow|sea sparrow/i,
    blurb: 'Ship-launched missile for defending warships against aircraft and anti-ship missiles.',
  },
  {
    match: /\bsm-6\b|\(sm\)-?6|standard missile[-\s(]*6|rim-174/i,
    blurb: 'Long-range naval surface-to-air and anti-ship missile for extended fleet defense.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/USS_John_Paul_Jones_%28DDG-53%29_launches_RIM-174_June_2014.JPG/960px-USS_John_Paul_Jones_%28DDG-53%29_launches_RIM-174_June_2014.JPG',
  },
  {
    match: /\bsm-3\b|\(sm\)-?3|standard missile[-\s(]*3|rim-161/i,
    blurb: 'Ship-launched ballistic-missile interceptor that engages threats outside the atmosphere.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Night_launch_of_a_RIM-161_Standard_SM-3.jpg/960px-Night_launch_of_a_RIM-161_Standard_SM-3.jpg',
  },
  {
    match: /\bsm-2\b|\(sm\)-?2|standard missile[-\s(]*2|standard missile|rim-66|rim-67/i,
    blurb: 'Naval surface-to-air missile for area air defense of ships and carrier strike groups.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/Standard_Missile_-_ID_060730-N-8977L-012.jpg/960px-Standard_Missile_-_ID_060730-N-8977L-012.jpg',
  },
  {
    match: /mk.?54|lightweight torpedo/i,
    blurb: 'Lightweight anti-submarine torpedo dropped from aircraft or fired from surface ships.',
  },
  {
    match: /mk.?48/i,
    blurb: 'Heavyweight submarine-launched torpedo for engaging ships and submerged submarines.',
  },
  {
    match: /f-?35[a-z]?|lightning ii|joint strike fighter/i,
    blurb: 'Fifth-generation multirole fighter built for stealth penetration, sensing, and precision strike.',
  },
  {
    match: /\bf[-\s]*15|eagle|strike eagle/i,
    blurb: 'Twin-engine air-superiority and strike fighter for long-range air combat and ground attack.',
  },
  {
    match: /f-?16[a-z]?|fighting falcon|kf-?16/i,
    blurb: 'Agile multirole fighter used for air-to-air combat, close air support, and strike.',
  },
  {
    match: /growler|ea-18/i,
    blurb: 'Electronic-attack derivative of the Super Hornet that jams and suppresses enemy air defenses.',
  },
  {
    match: /super hornet|f\/?a?-?18|fa-18|f-18/i,
    blurb: 'Carrier-based multirole fighter for air superiority, strike, and fleet defense.',
  },
  {
    match: /\be-7\b|wedgetail/i,
    blurb: 'Airborne early-warning and control jet that tracks air and maritime tracks for the joint force.',
  },
  {
    match: /\be-2\b|hawkeye/i,
    blurb: 'Carrier-capable airborne early-warning aircraft that detects and tracks aerial threats for the fleet.',
  },
  {
    match: /\bisr\b|intelligence,\s*surveillance,\s*and\s*reconnaissance/i,
    blurb: 'Sensor and mission systems that collect, process, and disseminate intelligence from air, ground, or maritime platforms.',
    url: '/system-images/isr.jpg',
  },
  {
    match: /re-3a|tactical air(?:borne)? surveillance system|\btass\b/i,
    blurb: 'SIGINT/ELINT surveillance aircraft that collects and relays electronic intelligence from high altitude.',
    url: '/system-images/re-3a-tass.jpg',
  },
  {
    match: /e-3|awacs|sentry/i,
    blurb: 'Airborne early-warning aircraft that detects and tracks aerial threats for the wider force.',
  },
  {
    match: /p-8|poseidon/i,
    blurb: 'Maritime patrol jet for anti-submarine warfare, anti-surface warfare, and broad-area surveillance.',
  },
  {
    match: /\bp-3\b|orion/i,
    blurb: 'Maritime patrol aircraft for anti-submarine warfare and ocean surveillance.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/20190206_P-8_Poseidon_Kadena_AB-12.jpg/960px-20190206_P-8_Poseidon_Kadena_AB-12.jpg',
  },
  {
    match: /c-17|globemaster/i,
    blurb: 'Strategic airlifter that moves troops, vehicles, and outsized cargo worldwide, including austere fields.',
  },
  {
    match: /c-27j|\bc-27\b/i,
    blurb: 'Tactical airlifter for short-field troop and cargo transport in austere environments.',
  },
  {
    match: /kc-130j/i,
    blurb: 'Multi-mission Hercules tanker-transport for aerial refueling, cargo, and assault support.',
    url: '/system-images/kc-130j.jpg',
  },
  {
    match: /c-130|hercules/i,
    blurb: 'Tactical airlifter for troop transport, airdrop, medevac, and special-operations support.',
    url: '/system-images/c-130.jpg',
  },
  {
    match: /mc-55a|peregrine/i,
    blurb: 'G550-based SIGINT/ELINT aircraft that collects and relays electronic intelligence from high altitude.',
    url: '/system-images/mc-55a.png',
  },
  {
    match: /gulfstream|g-?550|\bg550\b/i,
    blurb: 'Long-range business-jet airframe adapted for VIP, ISR, and special-mission roles.',
  },
  {
    match: /kc-46|kc-135|aerial refuel|tanker/i,
    blurb: 'Aerial refueling aircraft that extends the range and endurance of fighters and airlift fleets.',
  },
  {
    match: /mq-4|triton/i,
    blurb: 'High-altitude maritime surveillance drone for broad-area ocean and littoral ISR.',
  },
  {
    match: /mq-9|reaper|skyguardian|predator|remotely piloted/i,
    blurb: 'Long-endurance remotely piloted aircraft for surveillance and precision strike.',
  },
  {
    match: /global hawk|rq-4/i,
    blurb: 'High-altitude, long-endurance drone for wide-area intelligence, surveillance, and reconnaissance.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Global_Hawk_1.jpg/960px-Global_Hawk_1.jpg',
  },
  {
    match: /hh-60|jolly green/i,
    blurb: 'Combat-rescue helicopter built to recover isolated personnel from contested areas.',
  },
  {
    match: /uh-60|black.?hawk/i,
    blurb: 'Utility helicopter for troop lift, medevac, and general support in contested environments.',
  },
  {
    match: /uh-1|iroquois|huey/i,
    blurb: 'Light utility helicopter for transport, training, and general support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg/960px-Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg',
  },
  {
    match: /sh-60f|excess sh-60/i,
    blurb: 'Navy SH-60F Seahawk helicopter for anti-submarine warfare, search-and-rescue, and utility missions.',
    url: '/system-images/sh-60f-seahawk.jpg',
  },
  {
    match: /mh-60|seahawk|sh-60/i,
    blurb: 'Shipborne multi-mission helicopter for anti-submarine warfare, search-and-rescue, and surface attack.',
  },
  {
    match: /ah-1w|super.?cobra/i,
    blurb: 'Marine attack helicopter for close air support and anti-armor missions.',
    url: '/system-images/ah-1w.jpg',
  },
  {
    match: /ah-1z|ah-l\s*z|ah-1\b|cobra attack|\bcobra\b.*helicopter/i,
    blurb: 'Marine attack helicopter for close air support and anti-armor missions.',
  },
  {
    match: /ah-64|apache/i,
    blurb: 'Attack helicopter optimized for destroying armor and providing close fire support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/AH-64D_Apache_Longbow.jpg/960px-AH-64D_Apache_Longbow.jpg',
  },
  {
    match: /ch-47|chinook/i,
    blurb: 'Heavy-lift twin-rotor helicopter for moving troops, artillery, and oversized cargo.',
  },
  {
    match: /v-22|osprey|mv-22/i,
    blurb: 'Tiltrotor that combines helicopter vertical lift with airplane-like cruise speed for assault and logistics.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/V22-Osprey.jpg/960px-V22-Osprey.jpg',
  },
  {
    match: /ch-53|super stallion|king stallion/i,
    blurb: 'Heavy-lift assault support helicopter for moving troops and equipment ashore.',
  },
  {
    match: /bell 412|412ep/i,
    blurb: 'Medium twin utility helicopter used for transport, training, and support missions.',
  },
  {
    match: /t-6[ab]?|texan ii|texan aircraft/i,
    blurb: 'Turboprop trainer used to teach basic and intermediate military flying skills.',
  },
  {
    match: /abrams|m1a/i,
    blurb: 'Main battle tank combining heavy armor, a 120 mm gun, and networked fire control.',
    url: '/system-images/abrams.jpg',
  },
  {
    match: /eitan|8v199te21/i,
    blurb: 'Powerpack engines for the Israeli Eitan 8x8 wheeled armored personnel carrier.',
    url: '/system-images/eitan.jpg',
  },
  {
    match: /stryker/i,
    blurb: 'Wheeled armored combat vehicle family for infantry mobility and fire support.',
  },
  {
    match: /m777|howitzer/i,
    blurb: 'Lightweight 155 mm towed howitzer for mobile artillery support.',
  },
  {
    match: /jltv|joint light tactical/i,
    blurb: 'Protected light tactical vehicle that replaces many Humvee missions with better survivability.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/L-ATV_4.jpg/960px-L-ATV_4.jpg',
  },
  {
    match: /hmmwv|humvee|high mobility multi-purpose|m1151|m1152|m1165/i,
    blurb: 'Light wheeled tactical vehicle for troop and cargo transport.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/HMMWV_%28High_Mobility_Multipurpose_Wheeled_Vehicle%29_%2853686752373%29.jpg/960px-HMMWV_%28High_Mobility_Multipurpose_Wheeled_Vehicle%29_%2853686752373%29.jpg',
  },
  {
    match: /mrap|mine resistant|mastiff/i,
    blurb: 'Blast-resistant armored vehicle designed to protect crews from mines and IEDs.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/41/COUGAR_MRAP.png',
  },
  {
    match: /m113/i,
    blurb: 'Tracked armored personnel carrier for troop transport and support roles.',
  },
  {
    match: /\btow\b|bgm-71|tube-launched,\s*optically-tracked|tube-launched, optically-tracked/i,
    blurb: 'Wire- or wireless-guided anti-armor missile for defeating tanks and fortifications.',
  },
  {
    match: /assault amphibious|\baavs?\b|aavp/i,
    blurb: 'Tracked amphibious vehicle that carries Marines from ship to shore under fire.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/170606-N-PF515-398_%2834973155842%29.jpg/960px-170606-N-PF515-398_%2834973155842%29.jpg',
  },
  {
    match: /light armored vehicle|\blav\b/i,
    blurb: 'Wheeled amphibious combat vehicle for reconnaissance and fire support with Marine units.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/LAV-25A2.jpg/960px-LAV-25A2.jpg',
  },
  {
    match: /mmsc|multi-mission surface combatant|multi mission surface|surface combatant|\basc\b|meko/i,
    blurb: 'Multi-mission surface combatant for air defense, anti-surface, and anti-submarine warfare.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/0a/USS-Freedom-130222-N-DR144-174-crop.jpg',
  },
  {
    match: /phalanx|ciws|close-in weapon/i,
    blurb: 'Shipboard close-in weapon system that engages incoming missiles and aircraft at short range.',
  },
  {
    match: /aegis|arleigh burke|ddg|integrated combat system/i,
    blurb: 'Integrated naval combat system for tracking and engaging air, surface, and ballistic threats.',
    url: '/system-images/aegis.jpg',
  },
  {
    match: /emals|electromagnetic aircraft launch|advanced arresting gear/i,
    blurb: 'Carrier launch and recovery systems that accelerate and stop fixed-wing aircraft on deck.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/EMALS.JPG',
  },
  {
    match: /laircm|aaq-?24|directional infrared|infrared countermeasure/i,
    blurb: 'Directional infrared countermeasure suite that protects aircraft from heat-seeking missiles.',
    url: '/system-images/aaq-24-laircm.jpg',
  },
  {
    match: /sentinel|mpq-64/i,
    blurb: 'Mobile short-range air-defense radar that detects low-flying aircraft and drones.',
  },
  {
    match: /fps-132|early warning radar|ballistic missile defense radar|\bbmdr\b|tps-77|tps-78/i,
    blurb: 'Long-range or transportable radar that detects aircraft and ballistic threats.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/ELEC_AN-MPQ-64_Sentinel_Radar_lg.jpg',
  },
  {
    match: /firefinder|tpq-36|tpq-53/i,
    blurb: 'Counter-battery radar that locates enemy artillery, mortars, and rockets.',
  },
  {
    match: /aerostat/i,
    blurb: 'Tethered balloon radar system for persistent surveillance of air and surface tracks.',
  },
  {
    match: /switchblade|lmams|lethal miniature aerial/i,
    blurb: 'Tube-launched loitering munition for precision anti-personnel and anti-armor strikes.',
    url: '/system-images/switchblade-300.jpg',
  },
  {
    match: /counter-?unmanned|counter-?uas|\bc-uas\b|fs-lids|fixed site-low|altius/i,
    blurb: 'Sensors and effectors that detect and defeat small unmanned aircraft.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/FIM-92_Stinger_USMC.JPG/960px-FIM-92_Stinger_USMC.JPG',
  },
  {
    match: /patrol boat|patrol craft|mark v|fast missile craft|missile craft/i,
    blurb: 'Fast coastal craft for maritime security, interdiction, and special-operations support.',
  },
  {
    match: /frigate/i,
    blurb: 'Multi-mission surface combatant for escort, air defense, and anti-submarine warfare.',
  },
  {
    match: /tank cartridge|120\s*mm.*cartridge|tank ammunition/i,
    blurb: 'Large-caliber tank ammunition for main battle tanks.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Abrams-transparent.png/960px-Abrams-transparent.png',
  },
  {
    match: /f-?110|f100-pw|service life extension.*engine|engine.*service life/i,
    blurb: 'Fighter turbofan engines and life-extension work that keep combat aircraft flying.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/F-16_Demo_Team_2722.jpg/960px-F-16_Demo_Team_2722.jpg',
  },
  {
    match: /air traffic control|landing system|cns\/atm|navigation surveillance/i,
    blurb: 'Air-traffic control and navigation systems that manage military airfield and airspace operations.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/E-3_Sentry_Airborne_Warning_and_Control_System_%28AWACS%29_conducts_a_mission.jpg/960px-E-3_Sentry_Airborne_Warning_and_Control_System_%28AWACS%29_conducts_a_mission.jpg',
  },
  {
    match: /utility helicopter|light and medium utility/i,
    blurb: 'Utility helicopters for troop lift, logistics, and general support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg/960px-Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg',
  },
  {
    match: /heavy armored|armored combat system/i,
    blurb: 'Heavy armored combat vehicles for breakthrough and close combat.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Abrams-transparent.png/960px-Abrams-transparent.png',
  },
  {
    match: /mids[-/ ]?lvt|multifunctional information distribution system|mids on ships/i,
    blurb: 'Link 16 tactical data-link terminal that shares air and surface tracks across the battlespace.',
    url: '/system-images/mids-lvt.png',
  },
  {
    match: /radio equipment|\bc4i\b|tactical mission network|communication.*equipment|various radios/i,
    blurb: 'Radios and command networks that connect forces across the battlespace.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ea/ELEC_AN-MPQ-64_Sentinel_Radar_lg.jpg',
  },
  {
    match: /electronic attack mission|electronic warfare/i,
    blurb: 'Electronic-attack systems that jam and suppress enemy sensors and air defenses.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/U.S._Navy_EA-18G_Growler_breaks_away_from_a_U.S._Air_Force_KC-135_%28altered%29.jpg/960px-U.S._Navy_EA-18G_Growler_breaks_away_from_a_U.S._Air_Force_KC-135_%28altered%29.jpg',
  },
  {
    match: /construction|infrastructure|facilities and infrastructure|headquarters complex|technical assistance for construction|design and construction/i,
    blurb: 'Design and construction of defense facilities and supporting infrastructure.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /multi-platform maintenance|maintenance support/i,
    blurb: 'Maintenance and platform-support services that keep fleets mission-ready.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /family of medium tactical|medium tactical vehicle|\bmmtv\b|m1148/i,
    blurb: 'Medium tactical trucks for cargo, troop, and equipment transport.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/L-ATV_4.jpg/960px-L-ATV_4.jpg',
  },
  {
    match: /blanket order training/i,
    blurb: 'Recurring training and instruction under a blanket order that keeps partner forces proficient on U.S.-supplied systems.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /training|pilot training/i,
    blurb: 'Instruction, simulators, and training support that build aircrew and maintainer proficiency.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /system logistics and sustainment support/i,
    blurb: 'Program-level logistics and sustainment services that keep fielded systems operational.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /sustainment|follow-on support|logistics support|support services|fmso|follow-on technical|follow-on support/i,
    blurb: 'Spare parts, maintenance, and program services that keep platforms operational over time.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /ammunition for artillery|artillery systems, machine guns, and tanks/i,
    blurb: 'Mixed ordnance package covering artillery, machine-gun, and tank ammunition stocks.',
    url: '/system-images/blanket-order-training.jpg',
  },
  {
    match: /munition|ammo|ammunition|bomb|rocket|guidance kit|warhead/i,
    blurb: 'Ordnance stocks used to replenish combat inventories for air and ground forces.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/US_Navy_101020-N-4973M-111_Aviation_ordnancemen_prepare_to_load_a_Joint_Direct_Attack_Munition_%28JDAM%29_bomb_onto_an_F-A-18C_Hornet.jpg/960px-US_Navy_101020-N-4973M-111_Aviation_ordnancemen_prepare_to_load_a_Joint_Direct_Attack_Munition_%28JDAM%29_bomb_onto_an_F-A-18C_Hornet.jpg',
  },
]

const IMAGE_CATALOG: { match: RegExp; url: string }[] = (systemImages as ImageCatalogEntry[])
  .map(entry => {
    try {
      return { match: new RegExp(entry.pattern, 'i'), url: entry.url }
    } catch {
      return null
    }
  })
  .filter((entry): entry is { match: RegExp; url: string } => entry !== null)

export function getSystemVisual(system: string | null): SystemVisual {
  const category = categorize(system)
  const color = CATEGORY_COLORS[category]
  const hit = system
    ? SYSTEM_PROFILES.find(entry => entry.match.test(system))
    : undefined
  const catalog = system && !hit?.url
    ? IMAGE_CATALOG.find(entry => entry.match.test(system))
    : undefined

  const imageUrl = hit?.url ?? catalog?.url ?? null

  return {
    category,
    color,
    imageUrl,
    imageCredit: imageUrl ? (hit?.credit ?? null) : null,
    atmosphere: CATEGORY_ATMOSPHERE[category],
    blurb: hit?.blurb ?? CATEGORY_BLURB[category],
  }
}
