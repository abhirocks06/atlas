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
      : domain === 'amgeneral.com'
        ? [
            'https://icons.duckduckgo.com/ip3/amgeneral.com.ico',
            'https://www.google.com/s2/favicons?domain=amgeneral.com&sz=256',
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
