// State.gov Arms Sales Congressional Notifications Scraper
// 1. Change "View 10" to "50" at the bottom of the page (shows all items on one page)
// 2. Paste this into Chrome DevTools console
//
// Output: downloads state_notifications.json

(async function scrapeStateGov() {
  // Collect all notification links visible on the current page
  const allLinks = [...document.querySelectorAll('a[href*="releases/bureau-of-political-military-affairs"]')]
    .filter(a => {
      const t = a.textContent.trim()
      return t.length > 5 && t.length < 250
        && !/(follow us|bureau of|political-military|newsroom|about|contact)/i.test(t)
    })
    .map(a => ({ title: a.textContent.trim(), href: a.href }))

  // Deduplicate
  const unique = [...new Map(allLinks.map(l => [l.href, l])).values()]
  console.log(`Found ${unique.length} unique notification links on this page`)
  unique.forEach(l => console.log(' ', l.title.slice(0, 80)))

  if (unique.length === 0) {
    console.error('No links found — make sure you changed View to 50 and are on the notifications page')
    return
  }

  // Fetch each individual page for full details
  console.log('\nFetching individual pages...')
  const results = []

  for (let i = 0; i < unique.length; i++) {
    const { title, href } = unique[i]
    console.log(`  [${i + 1}/${unique.length}] ${title.slice(0, 70)}`)

    try {
      const res = await fetch(href, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')

      const body = doc.querySelector('article, .entry-content, [class*="post-content"], .container--content, main') || doc.body
      const text = (body?.innerText || body?.textContent || '').replace(/\s+/g, ' ').trim()

      // Country / System from title ("Country – System" or "Country - System")
      const dashIdx = title.search(/\s[–—-]\s/)
      const country = dashIdx > -1 ? title.slice(0, dashIdx).trim() : title
      const system = dashIdx > -1 ? title.slice(dashIdx + 3).trim() : null

      // Date — from meta tag or text
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
        // Fallback from URL: /2026/06/
        const u = href.match(/\/(\d{4})\/(\d{2})\//)
        if (u) date = `${u[1]}-${u[2]}-01`
      }

      // Transmittal — "Transmittal #26-56" or "Transmittal # 26-50" or "Transmittal No. 26-50"
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

      // Contractor — handles multiple separated by ";"
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

      results.push({ date, transmittal, country, system, costUSD, contractor, contractorLocation, sourceUrl: href })
    } catch (e) {
      console.error(`  Error: ${e.message}`)
      const di = title.search(/\s[–—-]\s/)
      results.push({
        date: null, transmittal: null,
        country: di > -1 ? title.slice(0, di).trim() : title,
        system: di > -1 ? title.slice(di + 3).trim() : null,
        costUSD: null, contractor: null, contractorLocation: null, sourceUrl: href,
      })
    }

    await new Promise(r => setTimeout(r, 400))
  }

  console.log(`\nDone. ${results.length} records.`)
  console.log('Null costs:', results.filter(r => !r.costUSD).length)
  console.log('Null dates:', results.filter(r => !r.date).length)
  console.log('No transmittal:', results.filter(r => !r.transmittal).length)

  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'state_notifications.json'
  a.click()
  console.log('Downloaded state_notifications.json')
})()
