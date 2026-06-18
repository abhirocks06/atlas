// DSCA Major Arms Sales - Browser Console Scraper v2
// Paste into Chrome DevTools console on https://www.dsca.mil/Press-Media/Major-Arms-Sales

(async function scrapeDSCA() {
  const results = []
  const BASE_URL = 'https://www.dsca.mil/Press-Media/Major-Arms-Sales'

  function extractFromDoc(doc) {
    const entries = []

    // DSCA Drupal structure: each row has a date span + title link
    // Try multiple selector strategies
    const rows = doc.querySelectorAll(
      '.views-row, article.node, .node--type-press-release, li.views-row'
    )

    if (rows.length > 0) {
      rows.forEach(row => {
        const link = row.querySelector('a')
        const dateEl = row.querySelector('time, .date-display-single, [class*="date"], span.field--name-field-date')
        const bodyEl = row.querySelector('[class*="body"], p, .views-field-body')
        parse(link, dateEl, bodyEl, entries)
      })
    } else {
      // Fallback: find all title links matching the "Country – System" pattern
      doc.querySelectorAll('a[href*="major-arms-sales/"]').forEach(link => {
        if (!link.textContent.includes('–') && !link.textContent.includes('-')) return
        // Walk up to find a container with date info
        let container = link.parentElement
        for (let i = 0; i < 4; i++) {
          if (container && container.parentElement) container = container.parentElement
        }
        const dateEl = container ? container.querySelector('time, [class*="date"], .field--name-field-date') : null
        const bodyEl = container ? container.querySelector('p') : null
        parse(link, dateEl, bodyEl, entries)
      })
    }

    return entries
  }

  function parse(link, dateEl, bodyEl, entries) {
    if (!link) return
    const title = link.textContent.trim()
    if (!title) return

    const url = link.href || ''
    const dateText = dateEl ? dateEl.textContent.trim() : ''
    const body = bodyEl ? bodyEl.textContent.trim() : ''

    const dashIdx = title.search(/\s[–—-]\s/)
    const country = dashIdx > -1 ? title.slice(0, dashIdx).trim() : title
    const system = dashIdx > -1 ? title.slice(dashIdx + 2).trim() : ''

    const costMatch = body.match(/estimated cost of (?:up to )?\$([0-9,.]+)\s*(million|billion)/i)
    let costUSD = null
    if (costMatch) {
      const num = parseFloat(costMatch[1].replace(/,/g, ''))
      costUSD = costMatch[2].toLowerCase() === 'billion' ? num * 1e9 : num * 1e6
    }

    let date = ''
    if (dateText) {
      const cleaned = dateText.replace(/\./g, '').trim() // "Feb. 6, 2026" → "Feb 6, 2026"
      const d = new Date(cleaned)
      if (!isNaN(d)) date = d.toISOString().slice(0, 10)
    }

    entries.push({ date, country, system, costUSD, sourceUrl: url })
  }

  // --- Debug: show what's on page 1 ---
  console.log('=== DOM DEBUG ===')
  const sampleLinks = document.querySelectorAll('a[href*="major-arms-sales"]')
  console.log('Links with "major-arms-sales" in href:', sampleLinks.length)
  if (sampleLinks.length > 0) {
    console.log('First 3 links:')
    Array.from(sampleLinks).slice(0, 3).forEach(a => console.log(' ', a.href, '|', a.textContent.trim().slice(0, 80)))
  }
  const allLinks = document.querySelectorAll('a')
  console.log('All links on page:', allLinks.length)
  const contentArea = document.querySelector('.view-content, main, [class*="view"], #content')
  console.log('Content container:', contentArea ? contentArea.className : 'NOT FOUND')
  console.log('=================')

  // Scrape page 1
  console.log('Scraping page 1...')
  const page1 = extractFromDoc(document)
  results.push(...page1)
  console.log(`  Found ${page1.length} entries`)

  // Detect actual last page from pagination
  const pageLinks = document.querySelectorAll('a[href*="Page="]')
  let maxPage = 1
  pageLinks.forEach(a => {
    const m = a.href.match(/Page=(\d+)/)
    if (m) maxPage = Math.max(maxPage, parseInt(m[1]))
  })
  console.log(`Detected ${maxPage} pages`)

  // Scrape remaining pages
  for (let page = 2; page <= maxPage; page++) {
    console.log(`Scraping page ${page}/${maxPage}...`)
    try {
      const res = await fetch(`${BASE_URL}?Page=${page}`, { credentials: 'include' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const pageResults = extractFromDoc(doc)
      results.push(...pageResults)
      console.log(`  Found ${pageResults.length} entries`)
      await new Promise(r => setTimeout(r, 400))
    } catch (e) {
      console.error(`  Error on page ${page}:`, e.message)
    }
  }

  console.log(`\nTotal entries scraped: ${results.length}`)

  // Download JSON
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dsca_notifications.json'
  a.click()
  console.log('Downloaded dsca_notifications.json')
})()
