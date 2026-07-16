import { categorize, CATEGORY_COLORS, type WeaponCategory } from './weaponCategories'

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

/** Profiles ordered most-specific first. Images from Wikimedia Commons / Wikipedia. */
const SYSTEM_PROFILES: SystemProfile[] = [
  {
    match: /hellfire|agm-114/i,
    blurb: 'Laser- or radar-guided air-to-ground missile for precision strikes from helicopters, aircraft, and drones.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/AGM-114_Hellfire_hung_on_a_Predator_drone.JPEG/960px-AGM-114_Hellfire_hung_on_a_Predator_drone.JPEG',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /apkws|precision kill weapon/i,
    blurb: 'Guidance kit that turns unguided Hydra-70 rockets into laser-guided precision munitions.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f4/APKWS.jpg/960px-APKWS.jpg',
    credit: 'Vslv / Wikimedia Commons',
  },
  {
    match: /javelin|fgm-148/i,
    blurb: 'Man-portable fire-and-forget anti-armor missile designed to defeat tanks from above.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/FGM-148_Javelin_-_ID_061024-A-0497K-004.JPEG/960px-FGM-148_Javelin_-_ID_061024-A-0497K-004.JPEG',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /stinger|fim-92/i,
    blurb: 'Shoulder-fired infrared-homing missile for short-range defense against aircraft and drones.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fe/FIM-92_Stinger_USMC.JPG/960px-FIM-92_Stinger_USMC.JPG',
    credit: 'U.S. Marine Corps / Wikimedia Commons',
  },
  {
    match: /amraam|aim-120/i,
    blurb: 'Beyond-visual-range air-to-air missile that lets fighters engage airborne threats before closing in.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/AIM-120C5_AMRAAM_rear_view.svg/960px-AIM-120C5_AMRAAM_rear_view.svg.png',
    credit: 'Wikimedia Commons',
  },
  {
    match: /sidewinder|aim-9/i,
    blurb: 'Short-range infrared air-to-air missile for close-in dogfight and self-defense engagements.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/41/AIM-9X_Sidewinder.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /patriot|pac-3|mim-104/i,
    blurb: 'Mobile surface-to-air system that intercepts aircraft, cruise missiles, and ballistic threats.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Flickr_-_Government_Press_Office_%28GPO%29_-_Patriot_missiles_being_launched_to_intercept_an_Iraqi_Scud_missile.jpg/960px-Flickr_-_Government_Press_Office_%28GPO%29_-_Patriot_missiles_being_launched_to_intercept_an_Iraqi_Scud_missile.jpg',
    credit: 'Government Press Office / Wikimedia Commons',
  },
  {
    match: /thaad|terminal high altitude/i,
    blurb: 'Upper-tier missile shield that destroys ballistic missiles outside the dense atmosphere.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg/960px-The_first_of_two_Terminal_High_Altitude_Area_Defense_%28THAAD%29_interceptors_is_launched_during_a_successful_intercept_test_-_US_Army.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /nasams/i,
    blurb: 'Networked surface-to-air system that uses AMRAAM-class missiles to defend airspace and critical sites.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Norwegian_Advanced_Surface_to_Air_Missile_System.jpg/960px-Norwegian_Advanced_Surface_to_Air_Missile_System.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /himars|m142|gmlrs|guided multiple launch|atacms/i,
    blurb: 'Wheeled rocket artillery that fires guided rockets and long-range missiles against land targets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/180614-A-IY962-102_-_M142_High_Mobility_Artillery_Rocket_System_%28HIMARS%29_firing_during_Saber_Strike_18_%28Image_4_of_7%29.jpg/960px-180614-A-IY962-102_-_M142_High_Mobility_Artillery_Rocket_System_%28HIMARS%29_firing_during_Saber_Strike_18_%28Image_4_of_7%29.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /jassm|agm-158|standoff missile/i,
    blurb: 'Stealthy air-launched cruise missile for striking hardened or defended targets from long range.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Global_Power_Bomber_CTF_conducts_B-1B_external_captive_carry_demonstration_%28201120-F-JG201-9095%29.jpg/960px-Global_Power_Bomber_CTF_conducts_B-1B_external_captive_carry_demonstration_%28201120-F-JG201-9095%29.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /jdam|joint direct attack/i,
    blurb: 'GPS/INS tail kit that converts gravity bombs into all-weather precision-guided munitions.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/US_Navy_101020-N-4973M-111_Aviation_ordnancemen_prepare_to_load_a_Joint_Direct_Attack_Munition_%28JDAM%29_bomb_onto_an_F-A-18C_Hornet.jpg/960px-US_Navy_101020-N-4973M-111_Aviation_ordnancemen_prepare_to_load_a_Joint_Direct_Attack_Munition_%28JDAM%29_bomb_onto_an_F-A-18C_Hornet.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /excalibur|m982/i,
    blurb: 'GPS-guided 155 mm artillery projectile for precise fire support against fixed ground targets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/5/5d/XM982_Excalibur_inert.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /harpoon|agm-84|ugm-84/i,
    blurb: 'Anti-ship cruise missile for engaging surface vessels from aircraft, ships, or submarines.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/8/84/Harpoon_asm_bowfin_museum.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /tomahawk|bgm-109|tlam/i,
    blurb: 'Long-range land-attack cruise missile launched from ships and submarines against fixed targets.',
  },
  {
    match: /essm|seasparrow|sea sparrow/i,
    blurb: 'Ship-launched missile for defending warships against aircraft and anti-ship missiles.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/RIM-162_launched_from_USS_Carl_Vinson_%28CVN-70%29_July_2010.jpg/960px-RIM-162_launched_from_USS_Carl_Vinson_%28CVN-70%29_July_2010.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /\bsm-2\b|standard missile|rim-66|rim-67/i,
    blurb: 'Naval surface-to-air missile for area air defense of ships and carrier strike groups.',
  },
  {
    match: /mk.?54|lightweight torpedo/i,
    blurb: 'Lightweight anti-submarine torpedo dropped from aircraft or fired from surface ships.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/USS_Roosevelt_%28DDG-80%29_launches_Mk_54_torpedo_in_April_2014.JPG/960px-USS_Roosevelt_%28DDG-80%29_launches_Mk_54_torpedo_in_April_2014.JPG',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /mk.?48/i,
    blurb: 'Heavyweight submarine-launched torpedo for engaging ships and submerged submarines.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Mk_48_torpedo_maintenance_1982.JPEG/960px-Mk_48_torpedo_maintenance_1982.JPEG',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /\bf-35\b|lightning ii|joint strike fighter/i,
    blurb: 'Fifth-generation multirole fighter built for stealth penetration, sensing, and precision strike.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/F-35_Heritage_Flight_Team_performs_in_Bell_Fort_Worth_Alliance_AirShow.jpg/960px-F-35_Heritage_Flight_Team_performs_in_Bell_Fort_Worth_Alliance_AirShow.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /\bf-15\b|eagle|strike eagle/i,
    blurb: 'Twin-engine air-superiority and strike fighter for long-range air combat and ground attack.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Green_Flag_West_11-08.jpg/960px-Green_Flag_West_11-08.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /\bf-16\b|fighting falcon/i,
    blurb: 'Agile multirole fighter used for air-to-air combat, close air support, and strike.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/F-16_Demo_Team_2722.jpg/960px-F-16_Demo_Team_2722.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /super hornet|f\/a-18[ef]|fa-18[ef]|f-18e|f-18f/i,
    blurb: 'Carrier-based multirole fighter for air superiority, strike, and fleet defense.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/US_Navy_071203-N-8923M-074_An_F-A-18F_Super_Hornet%2C_from_the_Red_Rippers_of_Strike_Fighter_Squadron_%28VFA%29_11%2C_makes_a_sharp_turn_above_the_flight_deck_aboard_the_Nimitz-class_nuclear-powered_aircraft_carrier_USS_Harry_S._Truman.jpg/960px-thumbnail.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /growler|ea-18/i,
    blurb: 'Electronic-attack derivative of the Super Hornet that jams and suppresses enemy air defenses.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/U.S._Navy_EA-18G_Growler_breaks_away_from_a_U.S._Air_Force_KC-135_%28altered%29.jpg/960px-U.S._Navy_EA-18G_Growler_breaks_away_from_a_U.S._Air_Force_KC-135_%28altered%29.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /e-3|awacs|sentry/i,
    blurb: 'Airborne early-warning aircraft that detects and tracks aerial threats for the wider force.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/E-3_Sentry_Airborne_Warning_and_Control_System_%28AWACS%29_conducts_a_mission.jpg/960px-E-3_Sentry_Airborne_Warning_and_Control_System_%28AWACS%29_conducts_a_mission.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /p-8|poseidon/i,
    blurb: 'Maritime patrol jet for anti-submarine warfare, anti-surface warfare, and broad-area surveillance.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/20190206_P-8_Poseidon_Kadena_AB-12.jpg/960px-20190206_P-8_Poseidon_Kadena_AB-12.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /c-17|globemaster/i,
    blurb: 'Strategic airlifter that moves troops, vehicles, and outsized cargo worldwide, including austere fields.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/C-17_test_sortie.jpg/960px-C-17_test_sortie.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /c-130|hercules/i,
    blurb: 'Tactical airlifter for troop transport, airdrop, medevac, and special-operations support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Hannover_Airport_Luftwaffe_German_Air_Force_Lockheed_Martin_C-130J-30_Hercules_55%2B02_%28DSC01156%29.jpg/960px-Hannover_Airport_Luftwaffe_German_Air_Force_Lockheed_Martin_C-130J-30_Hercules_55%2B02_%28DSC01156%29.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /kc-46|kc-135|aerial refuel|tanker/i,
    blurb: 'Aerial refueling aircraft that extends the range and endurance of fighters and airlift fleets.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Paris_Air_Show_2019%2C_Le_Bourget_%28SIAE1178%29.jpg/960px-Paris_Air_Show_2019%2C_Le_Bourget_%28SIAE1178%29.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /mq-9|reaper|skyguardian|remotely piloted/i,
    blurb: 'Long-endurance remotely piloted aircraft for surveillance and precision strike.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/MQ-9_Reaper_in_flight_%282007%29.jpg/960px-MQ-9_Reaper_in_flight_%282007%29.jpg',
    credit: 'U.S. Air Force / Wikimedia Commons',
  },
  {
    match: /global hawk|rq-4/i,
    blurb: 'High-altitude, long-endurance drone for wide-area intelligence, surveillance, and reconnaissance.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Global_Hawk_1.jpg/960px-Global_Hawk_1.jpg',
    credit: 'NASA / Wikimedia Commons',
  },
  {
    match: /uh-60|black.?hawk/i,
    blurb: 'Utility helicopter for troop lift, medevac, and general support in contested environments.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg/960px-Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /mh-60|seahawk/i,
    blurb: 'Shipborne multi-mission helicopter for anti-submarine warfare, search-and-rescue, and surface attack.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg/960px-Colombian_Air_Force_Sikorsky_UH-60L_Arp%C3%ADa_III_%28S-70A-41%29_Ram%C3%ADrez-1.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /ah-64|apache/i,
    blurb: 'Attack helicopter optimized for destroying armor and providing close fire support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/AH-64D_Apache_Longbow.jpg/960px-AH-64D_Apache_Longbow.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /ch-47|chinook/i,
    blurb: 'Heavy-lift twin-rotor helicopter for moving troops, artillery, and oversized cargo.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/An_Army_CH-47_Chinook_helicopter_during_a_training_exercise_%28210120-A-II094-096M%29.jpg/960px-An_Army_CH-47_Chinook_helicopter_during_a_training_exercise_%28210120-A-II094-096M%29.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /v-22|osprey/i,
    blurb: 'Tiltrotor that combines helicopter vertical lift with airplane-like cruise speed for assault and logistics.',
  },
  {
    match: /ch-53|super stallion|king stallion/i,
    blurb: 'Heavy-lift assault support helicopter for moving troops and equipment ashore.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/A_CH-53E_Super_Stallion_with_the_22nd_Marine_Expeditionary_Unit.jpg/960px-A_CH-53E_Super_Stallion_with_the_22nd_Marine_Expeditionary_Unit.jpg',
    credit: 'U.S. Marine Corps / Wikimedia Commons',
  },
  {
    match: /abrams|m1a/i,
    blurb: 'Main battle tank combining heavy armor, a 120 mm gun, and networked fire control.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Abrams-transparent.png/960px-Abrams-transparent.png',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /m777|howitzer/i,
    blurb: 'Lightweight 155 mm towed howitzer for mobile artillery support.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/M777_Light_Towed_Howitzer_1.jpg/960px-M777_Light_Towed_Howitzer_1.jpg',
    credit: 'U.S. Army / Wikimedia Commons',
  },
  {
    match: /jltv|joint light tactical/i,
    blurb: 'Protected light tactical vehicle that replaces many Humvee missions with better survivability.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/L-ATV_4.jpg/960px-L-ATV_4.jpg',
    credit: 'Wikimedia Commons',
  },
  {
    match: /mrap|mine resistant/i,
    blurb: 'Blast-resistant armored vehicle designed to protect crews from mines and IEDs.',
  },
  {
    match: /assault amphibious|aav|aavp/i,
    blurb: 'Tracked amphibious vehicle that carries Marines from ship to shore under fire.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/170606-N-PF515-398_%2834973155842%29.jpg/960px-170606-N-PF515-398_%2834973155842%29.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /light armored vehicle|\blav\b/i,
    blurb: 'Wheeled amphibious combat vehicle for reconnaissance and fire support with Marine units.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/LAV-25A2.jpg/960px-LAV-25A2.jpg',
    credit: 'U.S. Marine Corps / Wikimedia Commons',
  },
  {
    match: /aegis|arleigh burke|ddg/i,
    blurb: 'Integrated naval combat system for tracking and engaging air, surface, and ballistic threats.',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/USS_Arleigh_Burke_%28DDG_51%29_steams_through_the_Mediterranean_Sea.jpg/960px-USS_Arleigh_Burke_%28DDG_51%29_steams_through_the_Mediterranean_Sea.jpg',
    credit: 'U.S. Navy / Wikimedia Commons',
  },
  {
    match: /laircm|aaq-24|infrared countermeasure/i,
    blurb: 'Directional infrared countermeasure suite that protects aircraft from heat-seeking missiles.',
  },
  {
    match: /training|pilot training|blanket order training/i,
    blurb: 'Instruction, simulators, and training support that build aircrew and maintainer proficiency.',
  },
  {
    match: /sustainment|follow-on support|logistics support|support services|fmso/i,
    blurb: 'Spare parts, maintenance, and program services that keep platforms operational over time.',
  },
  {
    match: /munition|ammo|ammunition|bomb|rocket/i,
    blurb: 'Ordnance stocks used to replenish combat inventories for air and ground forces.',
  },
]

export function getSystemVisual(system: string | null): SystemVisual {
  const category = categorize(system)
  const color = CATEGORY_COLORS[category]
  const hit = system
    ? SYSTEM_PROFILES.find(entry => entry.match.test(system))
    : undefined

  return {
    category,
    color,
    imageUrl: hit?.url ?? null,
    imageCredit: hit?.credit ?? null,
    atmosphere: CATEGORY_ATMOSPHERE[category],
    blurb: hit?.blurb ?? CATEGORY_BLURB[category],
  }
}
