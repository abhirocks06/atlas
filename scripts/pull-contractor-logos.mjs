#!/usr/bin/env node
/**
 * Download contractor logos into public/contractor-logos/
 * Prefer Wayback Machine snapshots of the old Clearbit Logo API (higher quality).
 *
 * Run: node scripts/pull-contractor-logos.mjs
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '../public/contractor-logos')

const DOMAINS = [
  'boeing.com',
  'lockheedmartin.com',
  'rtx.com',
  'boozallen.com',
  'hii.com',
  'gd.com',
  'northropgrumman.com',
  'l3harris.com',
  'baesystems.com',
  'amgeneral.com',
  'bellflight.com',
  'beechcraft.com',
  'textron.com',
  'ga.com',
  'leonardodrs.com',
  'leidos.com',
  'v2x.com',
  'flir.com',
  'cae.com',
  'elbitsystems.com',
  'thalesgroup.com',
  'airbus.com',
  'rolls-royce.com',
  'geaerospace.com',
  'prattwhitney.com',
  'collinsaerospace.com',
  'honeywell.com',
  'kbr.com',
  'oshkoshdefense.com',
  'bwxt.com',
  'draper.com',
  'saic.com',
  'moog.com',
  'rocket.com',
  'navistar.com',
  'colt.com',
  'spartan.edu',
  'kratosdefense.com',
  'anduril.com',
  'maxar.com',
  'huntingtoningalls.com',
  'generalatomics.com',
  'zone5tech.com',
  'coaspire.com',
  'allisontransmission.com',
  'marvingroup.com',
  'avinc.com',
  'srcinc.com',
  'toyota.com',
  'aarcorp.com',
  'cat.com',
  'aollc.biz',
  'orbitalatk.com',
  'gcmicro.com',
  'spiritaero.com',
  'telephonics.com',
  'polezero.com',
  'terma.com',
  'extantaerospace.com',
  'arnprioraerospace.com',
  'martin-baker.com',
  'viasat.com',
  'sncorp.com',
  'kaman.com',
]

function slug(domain) {
  return domain.replace(/\./g, '-')
}

function isImage(buf) {
  if (buf.length < 24) return false
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) return true
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) return true
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49) return true
  // WebP
  if (buf[8] === 0x57 && buf[9] === 0x45) return true
  return false
}

async function fetchLogo(domain) {
  // Special cases: Clearbit returns a wordmark (RTX) or HTML (AM General)
  const urls =
    domain === 'rtx.com'
      ? [
          'https://icons.duckduckgo.com/ip3/rtx.com.ico',
          'https://www.google.com/s2/favicons?domain=rtx.com&sz=256',
        ]
      : domain === 'boozallen.com'
        ? [
            // Current teal "Booz Allen." mark (Clearbit/Wayback often serve older navy variant)
            'https://img.logo.dev/boozallen.com?token=pk_X-1ZO13GSgeOoUrIuJ6GMQ&size=256&format=png',
            'https://www.google.com/s2/favicons?domain=boozallen.com&sz=256',
            'https://web.archive.org/web/20240101000000id_/https://logo.clearbit.com/boozallen.com',
          ]
      : domain === 'amgeneral.com'
        ? [
            'https://icons.duckduckgo.com/ip3/amgeneral.com.ico',
            'https://www.google.com/s2/favicons?domain=amgeneral.com&sz=256',
          ]
        : domain === 'generalatomics.com'
          ? [
              // Official site SVG is white-on-transparent; Clearbit wordmark is black and invisible on dark UI
              'https://www.ga.com/images/favicon.ico',
              'https://icons.duckduckgo.com/ip3/ga.com.ico',
              'https://www.google.com/s2/favicons?domain=ga.com&sz=256',
            ]
        : domain === 'marvingroup.com'
          ? [
              // Official site wordmark (Clearbit often fails for this domain)
              'https://marvingroup.com/wp-content/uploads/2017/11/logo.png',
              'https://www.google.com/s2/favicons?domain=marvingroup.com&sz=128',
            ]
        : domain === 'avinc.com'
          ? [
              'https://www.avinc.com/images/logo.png',
              'https://www.avinc.com/images/logo.svg',
              'https://web.archive.org/web/20240101000000id_/https://logo.clearbit.com/avinc.com',
              'https://icons.duckduckgo.com/ip3/avinc.com.ico',
              'https://www.google.com/s2/favicons?domain=avinc.com&sz=256',
            ]
        : domain === 'srcinc.com'
          ? [
              'https://web.archive.org/web/20240101000000id_/https://logo.clearbit.com/srcinc.com',
              'https://icons.duckduckgo.com/ip3/srcinc.com.ico',
              'https://www.google.com/s2/favicons?domain=srcinc.com&sz=256',
              'https://www.srcinc.com/favicon.ico',
            ]
        : domain === 'aollc.biz'
          ? [
              'https://aollc.biz/AO_Logo_Long.png',
              'https://www.google.com/s2/favicons?domain=aollc.biz&sz=256',
            ]
        : domain === 'orbitalatk.com'
          ? [
              'https://web.archive.org/web/20180101000000id_/https://logo.clearbit.com/orbitalatk.com',
              'https://www.google.com/s2/favicons?domain=orbitalatk.com&sz=256',
            ]
        : domain === 'martin-baker.com'
          ? [
              'https://i0.wp.com/martin-baker.com/wp-content/uploads/2023/10/MB-logo-600-sq-px.png',
              'https://martin-baker.com/wp-content/uploads/2023/10/MB-logo-600-sq-px.png',
              'https://www.google.com/s2/favicons?domain=martin-baker.com&sz=256',
            ]
        : [
            `https://web.archive.org/web/20240101000000id_/https://logo.clearbit.com/${domain}`,
            `https://web.archive.org/web/20230101000000id_/https://logo.clearbit.com/${domain}`,
            `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
          ]
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: 'follow' })
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (!isImage(buf) || buf.length < 400) continue
      return buf
    } catch {
      /* try next */
    }
  }
  return null
}

const force = process.argv.includes('--force')
mkdirSync(OUT_DIR, { recursive: true })

let ok = 0
let fail = 0
for (const domain of DOMAINS) {
  const file = join(OUT_DIR, `${slug(domain)}.png`)
  // RTX circle mark is curated as black-on-white (favicon sources are dark-on-black)
  if (domain === 'rtx.com' && !process.argv.includes('--force-rtx') && existsSync(file)) {
    console.log(`skip  ${domain} (curated black-on-white; pass --force-rtx to overwrite)`)
    ok++
    continue
  }
  // General Atomics mark is curated (white star on navy) — Clearbit wordmark is invisible on dark UI
  if (domain === 'generalatomics.com' && !process.argv.includes('--force-ga') && existsSync(file)) {
    console.log(`skip  ${domain} (curated navy mark; pass --force-ga to overwrite)`)
    ok++
    continue
  }
  if (domain === 'aollc.biz' && !process.argv.includes('--force-ao') && existsSync(file)) {
    console.log(`skip  ${domain} (curated wordmark; pass --force-ao to overwrite)`)
    ok++
    continue
  }
  if (domain === 'orbitalatk.com' && !process.argv.includes('--force-orbitalatk') && existsSync(file)) {
    console.log(`skip  ${domain} (curated mark; pass --force-orbitalatk to overwrite)`)
    ok++
    continue
  }
  if (domain === 'sncorp.com' && !process.argv.includes('--force-snc') && existsSync(file)) {
    console.log(`skip  ${domain} (curated navy mark; pass --force-snc to overwrite)`)
    ok++
    continue
  }
  if (domain === 'kaman.com' && !process.argv.includes('--force-kaman') && existsSync(file)) {
    console.log(`skip  ${domain} (curated chevron mark; pass --force-kaman to overwrite)`)
    ok++
    continue
  }
  if (!force && existsSync(file)) {
    const size = execSync(`wc -c < "${file}"`).toString().trim()
    if (Number(size) >= 400) {
      console.log(`skip  ${domain}`)
      ok++
      continue
    }
  }
  process.stdout.write(`pull  ${domain} … `)
  const buf = await fetchLogo(domain)
  if (!buf) {
    console.log('FAIL')
    fail++
    continue
  }
  writeFileSync(file, buf)
  console.log(`${buf.length}b`)
  ok++
  await new Promise(r => setTimeout(r, 200))
}

console.log(`\nDone. ${ok} ok, ${fail} failed → ${OUT_DIR}`)
