// Step 1: Debug — paste this first on the State.gov notifications page
// Tell me what you see in the console

(function debug() {
  // Find all links containing "–" (en-dash) — notification titles
  const notifLinks = [...document.querySelectorAll('a')].filter(a => {
    const t = a.textContent.trim()
    return (t.includes('–') || t.includes('—')) && t.length > 10 && t.length < 200
  })
  console.log('Notification links found:', notifLinks.length)
  notifLinks.slice(0, 3).forEach(a => console.log(' ', a.href, '|', a.textContent.trim().slice(0, 80)))

  // Find pagination links
  const pageLinks = [...document.querySelectorAll('a')].filter(a => /^\d+$/.test(a.textContent.trim()))
  console.log('\nPagination number links:', pageLinks.length)
  pageLinks.forEach(a => console.log(' ', a.href, '| text:', a.textContent.trim()))

  // Find "next page" link
  const nextLink = [...document.querySelectorAll('a')].find(a =>
    /next|›|»|>/i.test(a.textContent.trim()) && a.href
  )
  console.log('\nNext page link:', nextLink?.href)

  // Check for any "page" in URLs
  const pageUrls = [...document.querySelectorAll('a[href*="page"]')].slice(0, 5)
  console.log('\nLinks with "page" in URL:')
  pageUrls.forEach(a => console.log(' ', a.href))
})()
