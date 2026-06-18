// Step 1: Collect all PDF URLs from DSCA Major Arms Sales Library
// Paste into Chrome DevTools console on:
// https://www.dsca.mil/Press-Media/Major-Arms-Sales/Major-Arms-Sales-Library
//
// Output: downloads dsca_pdf_urls.json with all PDF links

(async function collectPDFUrls() {
  const BASE = 'https://www.dsca.mil/Press-Media/Major-Arms-Sales/Major-Arms-Sales-Library'
  const allPdfs = []

  function extractPdfsFromDoc(doc, pageNum) {
    const entries = []
    // Each PDF tile: <a href="...pdf..."><img ...> or direct link
    doc.querySelectorAll('a[href*=".pdf"], a[href*=".PDF"]').forEach(a => {
      const href = a.href || a.getAttribute('href') || ''
      if (!href) return

      // Get label text (filename shown under the icon)
      const label = a.textContent.trim() ||
        a.closest('[class*="field"], li, div')?.textContent?.trim() || ''

      // Parse transmittal + country from filename
      // Format: "PRESS RELEASE - UKRAINE 25-105 CN.PDF"
      const filename = decodeURIComponent(href.split('/').pop() || '')
      const txMatch = filename.match(/[\s-](\d{2}-[\dA-Z]+)\s+CN/i)
      const transmittal = txMatch ? txMatch[1] : null

      // Country is everything between "PRESS RELEASE - " and the transmittal
      const countryMatch = filename.match(/PRESS\s+RELEASE\s*[-–]\s*(.+?)\s+\d{2}-[\dA-Z]+\s+CN/i)
      const country = countryMatch ? countryMatch[1].trim() : null

      entries.push({ href, filename, transmittal, country, label, page: pageNum })
    })
    return entries
  }

  // Detect last page number from current page
  let maxPage = 1
  document.querySelectorAll('a[href*="igpage="]').forEach(a => {
    const m = a.href.match(/igpage=(\d+)/)
    if (m) maxPage = Math.max(maxPage, parseInt(m[1]))
  })
  // Also check pagination text
  document.querySelectorAll('.pager__item a, .pagination a').forEach(a => {
    const m = a.href?.match(/igpage=(\d+)/)
    if (m) maxPage = Math.max(maxPage, parseInt(m[1]))
  })
  console.log(`Detected ${maxPage} pages`)

  // Page 1 (current)
  console.log('Collecting page 1...')
  const p1 = extractPdfsFromDoc(document, 1)
  allPdfs.push(...p1)
  console.log(`  Found ${p1.length} PDFs`)

  // Pages 2..N
  for (let page = 2; page <= maxPage; page++) {
    console.log(`Collecting page ${page}/${maxPage}...`)
    try {
      const res = await fetch(`${BASE}?igpage=${page}`, { credentials: 'include' })
      const html = await res.text()
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const entries = extractPdfsFromDoc(doc, page)
      allPdfs.push(...entries)
      console.log(`  Found ${entries.length} PDFs`)
      await new Promise(r => setTimeout(r, 300))
    } catch (e) {
      console.error(`  Error on page ${page}:`, e.message)
    }
  }

  // Deduplicate by href
  const seen = new Set()
  const unique = allPdfs.filter(p => {
    if (seen.has(p.href)) return false
    seen.add(p.href)
    return true
  })

  console.log(`\nTotal unique PDFs: ${unique.length}`)
  console.log('Sample:', unique.slice(0, 3))

  // Download
  const blob = new Blob([JSON.stringify(unique, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'dsca_pdf_urls.json'
  a.click()
  console.log('Downloaded dsca_pdf_urls.json')
})()
