// Fetches the 9 missing State.gov notifications directly by URL
// Paste into Chrome DevTools console on any State.gov page

(async function fetchMissing() {
  const MISSING = [
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/04/singapore-guided-multiple-launch-rocket-system-alternative-warhead/', country: 'Singapore', system: 'Guided Multiple Launch Rocket System-Alternative Warhead' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/belgium-communications-equipment/', country: 'Belgium', system: 'Communications Equipment' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/japan-hyper-velocity-gliding-projectile-hvgp-program-support/', country: 'Japan', system: 'Hyper Velocity Gliding Projectile (HVGP) Program Support' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/republic-of-korea-arc-210-rt-2036c-secure-radios-and-ky-100m-communication-security-devices/', country: 'Republic of Korea', system: 'ARC-210 RT-2036(C) Secure Radios and KY-100M Communication Security Devices' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/government-of-jordan-aircraft-repair-return-and-spares/', country: 'Jordan', system: 'Aircraft Repair, Return, and Spares' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/united-arab-emirates-long-range-discrimination-radar-with-terminal-high-altitude-area-defense-integration/', country: 'United Arab Emirates', system: 'Long-Range Discrimination Radar with Terminal High Altitude Area Defense Integration' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/united-arab-emirates-advanced-medium-range-air-to-air-missiles-amraams/', country: 'United Arab Emirates', system: 'Advanced Medium-Range Air-to-Air Missiles (AMRAAMs)' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/03/israel-munitions-and-munitions-support/', country: 'Israel', system: 'Munitions and Munitions Support' },
    { url: 'https://www.state.gov/releases/bureau-of-political-military-affairs/2026/02/jordan-ku-band-multi-function-radio-frequency-system-kumrfs-radars/', country: 'Jordan', system: 'Ku Band Multi-Function Radio Frequency System (KuMRFS) Radars' },
  ]

  const results = []

  for (let i = 0; i < MISSING.length; i++) {
    const { url, country, system } = MISSING[i]
    console.log(`[${i + 1}/${MISSING.length}] Fetching ${country} – ${system.slice(0, 50)}...`)

    try {
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const body = doc.querySelector('article, .entry-content, [class*="post-content"], .container--content, main') || doc.body
      const text = (body?.innerText || body?.textContent || '').replace(/\s+/g, ' ').trim()

      // Date
      let date = null
      const metaDate = doc.querySelector('meta[property="article:published_time"], time[datetime]')
      if (metaDate) {
        const raw = metaDate.getAttribute('content') || metaDate.getAttribute('datetime')
        const d = new Date(raw)
        if (!isNaN(d)) date = d.toISOString().slice(0, 10)
      }
      if (!date) {
        const m = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d\d\b/)
        if (m) { const d = new Date(m[0]); if (!isNaN(d)) date = d.toISOString().slice(0, 10) }
      }
      if (!date) {
        const u = url.match(/\/(\d{4})\/(\d{2})\//)
        if (u) date = `${u[1]}-${u[2]}-01`
      }

      // Transmittal — State.gov uses "#26-56" format
      let transmittal = null
      const txMatch = text.match(/Transmittal\s*[#No\.]+\s*([0-9]{2}-\s*[A-Z0-9]+)/i)
      if (txMatch) transmittal = txMatch[1].replace(/\s/g, '')

      // Cost
      let costUSD = null
      const costMatch = text.match(
        /(?:(?:total\s+)?estimated\s+(?:cost|sale\s+price|value)|valued\s+at|a\s+cost|worth\s+approximately|estimated cost of)\s+(?:is\s+)?(?:of\s+)?(?:up\s+to\s+)?\$\s*([0-9,.]+)\s*(million|billion)/i
      )
      if (costMatch) {
        const num = parseFloat(costMatch[1].replace(/,/g, ''))
        costUSD = costMatch[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6
      } else {
        const any = text.match(/\$\s*([0-9,.]+)\s*(million|billion)/i)
        if (any) {
          const num = parseFloat(any[1].replace(/,/g, ''))
          costUSD = any[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6
        }
      }

      // Contractor
      let contractor = null
      let contractorLocation = null
      const cMatch = text.match(/[Pp]rincipal [Cc]ontractors?\(?s?\)?\s+will be\s+([^.]+)\./)
      if (cMatch) {
        const raw = cMatch[1].trim()
        const isTBD = /\b(determined|identified|negotiated|selected|various|no prime)\b/i.test(raw)
        if (!isTBD) {
          const parts = raw.split(/;\s*(?:and\s+)?/)
          const names = [], locs = []
          for (const part of parts) {
            const locMatch = part.match(/^(.+?),?\s+located in\s+(.+)$/i)
            if (locMatch) { names.push(locMatch[1].trim()); locs.push(locMatch[2].trim()) }
            else names.push(part.trim())
          }
          contractor = names.filter(Boolean).join(' / ') || null
          contractorLocation = locs.filter(Boolean).join(' / ') || null
        }
      }

      const record = { date, transmittal, country, system, costUSD, contractor, contractorLocation, sourceUrl: url }
      results.push(record)
      console.log(`  ✓ date=${date} cost=${costUSD ? '$' + (costUSD/1e6).toFixed(0) + 'M' : 'null'} transmittal=${transmittal}`)
    } catch (e) {
      console.error(`  ✗ ${e.message}`)
      results.push({ date: null, transmittal: null, country, system, costUSD: null, contractor: null, contractorLocation: null, sourceUrl: url })
    }

    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\nDone. ${results.length} records.`)

  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'state_missing.json'
  a.click()
  console.log('Downloaded state_missing.json')
})()
