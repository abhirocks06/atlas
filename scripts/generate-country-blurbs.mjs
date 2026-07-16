/**
 * Generate country-page geopolitical blurbs via Meta Muse Spark 1.1.
 * Writes/merges into data/country_blurbs.json (bundled; not live API in the browser).
 *
 * Usage:
 *   node scripts/generate-country-blurbs.mjs                 # default preview set
 *   node scripts/generate-country-blurbs.mjs --all           # top partners by value
 *   node scripts/generate-country-blurbs.mjs Israel Ukraine  # named countries
 *
 * Requires MODEL_API_KEY in .env (https://api.meta.ai/v1).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DATA_PATH = resolve(ROOT, 'data/fms_notifications.json')
const OUT_PATH = resolve(ROOT, 'data/country_blurbs.json')
const ENV_PATH = resolve(ROOT, '.env')

const API_URL = 'https://api.meta.ai/v1/chat/completions'
const MODEL = 'muse-spark-1.1'

const PREVIEW = ['Israel', 'Ukraine', 'Saudi Arabia']
const TOP_N = 12

function loadEnv() {
  if (!existsSync(ENV_PATH)) return
  for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    if (!(m[1] in process.env)) process.env[m[1]] = m[2]
  }
}

function topCountries(data, n) {
  const map = new Map()
  for (const row of data) {
    if (!row.country) continue
    const prev = map.get(row.country) ?? { cost: 0, count: 0, systems: new Map() }
    prev.cost += row.costUSD ?? 0
    prev.count += 1
    const key = (row.system ?? '').split(/[,;]/)[0].trim().slice(0, 48)
    if (key) prev.systems.set(key, (prev.systems.get(key) ?? 0) + (row.costUSD ?? 0))
    map.set(row.country, prev)
  }
  return [...map.entries()]
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, n)
    .map(([country, stats]) => ({
      country,
      topSystems: [...stats.systems.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name),
    }))
}

function countryContext(data, country) {
  const rows = data.filter(n => n.country === country)
  const systems = new Map()
  for (const n of rows) {
    const key = (n.system ?? '').split(/[,;]/)[0].trim().slice(0, 48)
    if (!key) continue
    systems.set(key, (systems.get(key) ?? 0) + (n.costUSD ?? 0))
  }
  return {
    country,
    topSystems: [...systems.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name),
  }
}

async function generateBlurb({ country, topSystems }) {
  const systemList = topSystems.length
    ? topSystems.join('; ')
    : 'various defense systems'
  const prompt = `Write 2 sentences of neutral encyclopedia-style context for a U.S. Foreign Military Sales country page about ${country}.

Focus ONLY on: alliance / partner status, the durable relationship with the United States, and why that relationship exists (geography, conflict, treaty, regional pressure). Use a specific well-known public date only if confident.

Rules:
- Restrained and factual. No advocacy. No invented current events.
- Do NOT list weapon systems, platforms, model names, dollars, or notification counts.
- Do NOT write "notifications have concentrated on…" equipment lists.
- If unsure of a date or designation, omit it.
- Output ONLY the prose.`

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You write short neutral encyclopedia-style context blurbs about U.S. security partnerships. Stay factual and restrained. Never invent dates. Output prose only.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  })

  const json = await res.json()
  if (!res.ok || json.error) {
    const msg = json?.error?.message ?? JSON.stringify(json)
    throw new Error(`${country}: ${msg}`)
  }
  const text = json.choices?.[0]?.message?.content?.trim()
  if (!text) throw new Error(`${country}: empty response`)
  return text
}

async function main() {
  loadEnv()
  if (!process.env.MODEL_API_KEY) {
    console.error('MODEL_API_KEY missing in .env')
    process.exit(1)
  }

  const args = process.argv.slice(2).filter(a => a !== '--all')
  const doAll = process.argv.includes('--all')
  const data = JSON.parse(readFileSync(DATA_PATH, 'utf8'))
  const existing = existsSync(OUT_PATH)
    ? JSON.parse(readFileSync(OUT_PATH, 'utf8'))
    : {}

  let targets
  if (args.length) {
    targets = args.map(c => countryContext(data, c))
  } else if (doAll) {
    targets = topCountries(data, TOP_N)
  } else {
    targets = PREVIEW.map(c => countryContext(data, c))
  }

  const today = new Date().toISOString().slice(0, 10)
  console.log(`Generating ${targets.length} blurb(s) with ${MODEL}…`)

  for (const target of targets) {
    if (!target.topSystems.length) {
      console.warn(`skip ${target.country}: no notifications`)
      continue
    }
    process.stdout.write(`  ${target.country}… `)
    try {
      const blurb = await generateBlurb(target)
      existing[target.country] = {
        blurb,
        source: MODEL,
        updatedAt: today,
      }
      console.log('ok')
      console.log(`    ${blurb.slice(0, 120)}…`)
    } catch (err) {
      console.log('FAIL')
      console.error(`    ${err.message}`)
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify(existing, null, 2) + '\n')
  console.log(`\nWrote ${OUT_PATH}`)
}

main()
