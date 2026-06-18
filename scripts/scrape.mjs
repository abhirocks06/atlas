import fetch from 'node-fetch';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = 'https://www.federalregister.gov/api/v1/articles.json';
const DELAY_MS = 350;           // between page fetches
const ARTICLE_DELAY_MS = 400;   // between article text fetches
const RETRY_DELAY_MS = 1500;
const MAX_RETRIES = 2;
const DATE_START = '2023-01-01';
const DATE_END = '2026-06-17';
const PER_PAGE = 100;           // API max appears to be 100 reliably

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJSON(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FMS-Scraper/1.0 (research/educational)' },
        timeout: 30000,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
      }
      return await res.json();
    } catch (err) {
      if (attempt < retries) {
        console.warn(`    [retry ${attempt + 1}/${retries}] ${err.message.slice(0, 80)}`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }
}

async function fetchText(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FMS-Scraper/1.0 (research/educational)' },
        timeout: 30000,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (err) {
      if (attempt < retries) {
        console.warn(`    [retry ${attempt + 1}/${retries}] ${err.message.slice(0, 80)}`);
        await sleep(RETRY_DELAY_MS);
      } else {
        throw err;
      }
    }
  }
}

/** Build a query string WITHOUT URLSearchParams (which de-dupes array keys). */
function buildQS(params) {
  return Object.entries(params)
    .flatMap(([k, v]) =>
      Array.isArray(v)
        ? v.map((val) => `${encodeURIComponent(k)}=${encodeURIComponent(val)}`)
        : [`${encodeURIComponent(k)}=${encodeURIComponent(v)}`]
    )
    .join('&');
}

// ── Text cleaning ─────────────────────────────────────────────────────────────
function cleanHtmlText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<a\s[^>]*>[\s\S]*?<\/a>/gi, ' ')   // remove anchor content (obfuscated emails)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Collapse runs of spaces (but preserve newlines)
    .replace(/[ \t]{2,}/g, ' ')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Parsers ───────────────────────────────────────────────────────────────────

/** Transmittal No. from docket_ids array OR text */
function parseTransmittal(docketIds, text) {
  // Prefer docket_ids field — it's always clean
  if (Array.isArray(docketIds)) {
    for (const d of docketIds) {
      const m = d.match(/Transmittal\s+No\.?\s*([\d]{2}-[\d]+)/i);
      if (m) return m[1];
    }
  }
  // Fallback: text
  const m = text.match(/Transmittal\s+No\.?\s*([\d]{2}-[\d]+)/i);
  return m ? m[1] : null;
}

/** Country from "Prospective Purchaser: ..." or title fallback */
function parseCountry(text, title) {
  // Highest-signal pattern in the structured section
  let m = text.match(/Prospective\s+Purchaser:\s*([^\n\r]+)/i);
  if (m) {
    let country = m[1]
      .replace(/^(?:Government of|the\s+Government of)\s*/i, '')
      .trim()
      .replace(/[.,;]$/, '');
    // Trim at any parenthetical or table artifact: "(ii)" or "$"
    country = country.split(/\s*\(ii\)|\s*\$|\s{3,}/)[0].trim();
    // Remove trailing punctuation
    country = country.replace(/[.,;:]+$/, '').trim();
    return country || null;
  }
  // From policy justification heading: "COUNTRY--System Name"
  m = text.match(/^([A-Z][A-Za-z\s\-]+)--[A-Z]/m);
  if (m && m[1].length < 60) return m[1].trim();

  // From title: "...to COUNTRY" or "Government of COUNTRY"
  m = (title || '').match(/Letter of Offer[^)]*?\bto\s+(?:the\s+)?([A-Z][^–\-—\(\n]+?)(?:\s*$|(?=[,\(]))/i);
  if (m) return m[1].trim().replace(/[.,;]$/, '');

  m = (title || '').match(/[Gg]overnment of ([A-Z][A-Za-z\s\-]+?)(?:[,\(]|$)/);
  if (m) return m[1].trim();

  return null;
}

/** Primary defense system — from the MDE section or policy heading */
function parseSystem(text, country) {
  // Option 1: First item under "Major Defense Equipment (MDE):" in the structured section.
  // The raw text has line-wrapped items — collect all lines until "Non-MDE" or blank line.
  const mdeMatch = text.match(/Major\s+Defense\s+Equipment\s*\(MDE\)\s*:\s*\n([\s\S]+?)(?:Non-MDE|Non MDE|\n\s*\n)/i);
  if (mdeMatch) {
    // Get just the first item line (possibly wrapped across 2 lines)
    const section = mdeMatch[1].trim();
    // Join wrapped lines: lines that begin with '(' (continuation) merge with previous
    const joined = section.replace(/\n\s*\(/g, ' (');
    const firstLine = joined.split('\n')[0].trim();
    // Strip quantity prefixes like "Seventy (70) " or "Two hundred (200) " or "(70) "
    const stripped = firstLine
      .replace(/^\s*(?:[A-Za-z][a-z]*(?:\s+[A-Za-z][a-z]*)*\s+)?\(?\d[\d,]*\)?\s+/i, '')
      .trim();
    // Skip degenerate values
    if (stripped.length > 3 && stripped.length < 200 && !/^None$/i.test(stripped)) {
      return stripped;
    }
  }

  // Option 2: From policy justification heading "COUNTRY--SYSTEM NAME\n"
  if (country) {
    // Escape only the part we know — country might have special chars
    const m = text.match(
      new RegExp(
        String.raw`${escapeRe(country)}--([^\n\r]{3,150})`,
        'i'
      )
    );
    if (m) return m[1].trim();
  }

  // Option 3: After "requested to buy [count] SYSTEM NAME"
  const m = text.match(
    /requested to buy\s+(?:[a-z\-]+\s+)?\(?\d[\d,]*\)?\s+([A-Z][^\n.;]{5,150})/i
  );
  if (m) {
    const raw = m[1].trim();
    // Stop at " and " or ";" which introduces additional items
    return raw.split(/\s+and\s+(?:two|one|three|four|five|six|\d)/i)[0]
              .split(/[;–—]/)[0]
              .trim();
  }

  return null;
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Largest dollar amount in the text → number */
function parseCost(text) {
  const re = /\$([\d,\.]+)\s*(billion|million)/gi;
  let max = null;
  let match;
  while ((match = re.exec(text)) !== null) {
    const num = parseFloat(match[1].replace(/,/g, ''));
    if (isNaN(num)) continue;
    const mult = match[2].toLowerCase() === 'billion' ? 1_000_000_000 : 1_000_000;
    const val = num * mult;
    if (max === null || val > max) max = val;
  }
  return max;
}

/** Contractor name + location */
function parseContractor(text) {
  // Pattern A: "principal contractor will be NAME, located in CITY, ST"
  let m = text.match(/[Pp]rincipal\s+contractor(?:s)?\s+will\s+be\s+([^,\n]+),\s*located\s+in\s+([A-Za-z\s\.]+),\s*([A-Z]{2})\b/i);
  if (m) {
    return {
      contractor: m[1].trim(),
      contractorLocation: `${m[2].trim()}, ${m[3]}`,
    };
  }

  // Pattern B: "principal contractor will be NAME, CITY, ST."
  m = text.match(/[Pp]rincipal\s+contractor(?:s)?\s+will\s+be\s+([^\.]+?),\s*([A-Za-z][A-Za-z\s\.]+),\s*([A-Z]{2})(?:\s+\d{5})?\s*[.,]/i);
  if (m) {
    return {
      contractor: m[1].trim(),
      contractorLocation: `${m[2].trim()}, ${m[3]}`,
    };
  }

  // Pattern C: just grab everything up to the period
  m = text.match(/[Pp]rincipal\s+contractor(?:s)?\s+will\s+be\s+([^\.]{3,120})\./i);
  if (m) {
    const raw = m[1].trim();
    // Try to split city/state at end
    const locM = raw.match(/,\s*([A-Za-z][A-Za-z\s\.]+),\s*([A-Z]{2})(?:\s+\d{5})?$/);
    if (locM) {
      const name = raw.slice(0, raw.lastIndexOf(locM[0])).trim().replace(/,$/, '');
      return {
        contractor: name || null,
        contractorLocation: `${locM[1].trim()}, ${locM[2]}`,
      };
    }
    return { contractor: raw, contractorLocation: null };
  }

  return { contractor: null, contractorLocation: null };
}

// ── Parse one article's raw text ──────────────────────────────────────────────
function parseArticle(meta, rawText) {
  const text = cleanHtmlText(rawText);
  const title = meta.title || '';

  const transmittal = parseTransmittal(meta.docket_ids, text);
  const country = parseCountry(text, title);
  const system = parseSystem(text, country);
  const costUSD = parseCost(text);
  const { contractor, contractorLocation } = parseContractor(text);

  return {
    date: meta.publication_date || null,
    transmittal,
    country,
    system,
    costUSD,
    contractor,
    contractorLocation,
    _source: meta.html_url || null,
    _docNumber: meta.document_number || null,
    _title: title,
  };
}

// ── Fetch list pages ──────────────────────────────────────────────────────────
async function fetchAllStubs() {
  const stubs = [];

  /**
   * Each query uses a different search term.
   * Per-page = 100 (API supports this reliably).
   * Fields are passed as repeated keys: fields[]=title&fields[]=publication_date ...
   */
  const FIELDS = ['title', 'publication_date', 'document_number', 'html_url', 'abstract', 'docket_ids'];

  const queries = [
    {
      label: 'keyword: "arms sale notification" (primary)',
      extra: {
        'conditions[term]': 'arms sale notification',
      },
    },
    {
      label: 'keyword: "Letter of Offer and Acceptance"',
      extra: {
        'conditions[term]': 'Letter of Offer Acceptance foreign military sale',
      },
    },
  ];

  for (const q of queries) {
    console.log(`\n[query] ${q.label}`);

    const baseParams = {
      per_page: String(PER_PAGE),
      order: 'newest',
      'conditions[publication_date][gte]': DATE_START,
      'conditions[publication_date][lte]': DATE_END,
      ...q.extra,
    };
    // Add fields[] as array
    const paramsWithFields = { ...baseParams, 'fields[]': FIELDS };

    let url = `${BASE_URL}?${buildQS(paramsWithFields)}`;
    let page = 1;
    let totalPages = null;

    while (url) {
      console.log(`  Page ${page}${totalPages ? `/${totalPages}` : ''} — ${url.slice(0, 80)}...`);
      let data;
      try {
        data = await fetchJSON(url);
      } catch (err) {
        console.error(`  ERROR fetching page ${page}: ${err.message.slice(0, 120)}`);
        break;
      }

      const results = data.results || [];
      if (page === 1) {
        const count = data.count || 0;
        totalPages = data.total_pages || Math.ceil(count / PER_PAGE) || 1;
        console.log(`  Total count: ${count} (${totalPages} pages)`);
        if (count === 0) console.warn('  WARNING: 0 results for this query.');
      }

      stubs.push(...results);

      // next_page_url comes back from API — use it directly
      url = data.next_page_url || null;
      page++;
      if (url) await sleep(DELAY_MS);
    }
  }

  // Deduplicate by document_number
  const seen = new Set();
  const unique = stubs.filter((s) => {
    if (!s.document_number || seen.has(s.document_number)) return false;
    seen.add(s.document_number);
    return true;
  });

  console.log(`\n[dedup] ${stubs.length} total → ${unique.length} unique stubs`);
  return unique;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FMS Congressional Notification Scraper ===');
  console.log(`Date range: ${DATE_START} → ${DATE_END}`);
  console.log(`Output dir: ${DATA_DIR}\n`);

  mkdirSync(DATA_DIR, { recursive: true });

  // Step 1: Collect stubs
  const stubs = await fetchAllStubs();

  if (stubs.length === 0) {
    console.warn('\nWARNING: No stubs found. Writing empty output.');
    writeFileSync(resolve(DATA_DIR, 'fms_notifications.json'), JSON.stringify([], null, 2));
    writeFileSync(
      resolve(DATA_DIR, 'scrape_log.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), totalFetched: 0, parsedCount: 0, parseErrors: 0 }, null, 2)
    );
    return;
  }

  // Step 2: Filter — keep only clear FMS notifications by title keywords
  const FMS_TITLE_RE = /arms\s+sale|letter of offer|transmittal|proposed issuance|foreign military/i;
  const fmsStubs = stubs.filter((s) => FMS_TITLE_RE.test(s.title || ''));
  const skippedFilter = stubs.length - fmsStubs.length;
  console.log(`\n[filter] ${fmsStubs.length}/${stubs.length} stubs match FMS title patterns`);

  // Step 3: For each stub, fetch the raw text file and parse
  const notifications = [];
  const errors = [];

  for (let i = 0; i < fmsStubs.length; i++) {
    const stub = fmsStubs[i];
    const docNum = stub.document_number;
    const pubDate = stub.publication_date;
    process.stdout.write(`  [${i + 1}/${fmsStubs.length}] ${docNum} (${pubDate}) ... `);

    try {
      // Build raw_text_url from publication date + document number
      // Format: https://www.federalregister.gov/documents/full_text/text/YYYY/MM/DD/DOCNUM.txt
      const [year, month, day] = (pubDate || '').split('-');
      const rawTextUrl = `https://www.federalregister.gov/documents/full_text/text/${year}/${month}/${day}/${docNum}.txt`;

      // Also need docket_ids from the JSON API (for transmittal number)
      // Fetch JSON metadata (lightweight — no body field needed)
      let metaJson = stub; // use stub defaults
      try {
        const metaUrl = `https://www.federalregister.gov/api/v1/articles/${docNum}.json?fields%5B%5D=docket_ids&fields%5B%5D=title&fields%5B%5D=publication_date&fields%5B%5D=html_url&fields%5B%5D=document_number`;
        const fetched = await fetchJSON(metaUrl);
        metaJson = { ...stub, ...fetched };
      } catch (e) {
        // non-fatal — use stub data
      }

      const rawText = await fetchText(rawTextUrl);
      const parsed = parseArticle(metaJson, rawText);

      if (parsed.country || parsed.transmittal) {
        notifications.push(parsed);
        process.stdout.write(`OK (${parsed.country || '?'}, ${parsed.transmittal || '?'})\n`);
      } else {
        process.stdout.write(`SKIP (no country/transmittal parsed)\n`);
        skippedFilter + 1; // note: intentionally not modifying count — just logging
      }
    } catch (err) {
      process.stdout.write(`ERROR — ${err.message.slice(0, 60)}\n`);
      errors.push({ docNumber: docNum, error: err.message });
    }

    await sleep(ARTICLE_DELAY_MS);
  }

  // Step 4: Sort newest first
  notifications.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  // Step 5: Write outputs
  const outPath = resolve(DATA_DIR, 'fms_notifications.json');
  const logPath = resolve(DATA_DIR, 'scrape_log.json');

  writeFileSync(outPath, JSON.stringify(notifications, null, 2));

  const log = {
    timestamp: new Date().toISOString(),
    dateRangeStart: DATE_START,
    dateRangeEnd: DATE_END,
    totalStubsFetched: stubs.length,
    filteredAsFMS: fmsStubs.length,
    parsedCount: notifications.length,
    parseErrors: errors.length,
    skippedByTitleFilter: skippedFilter,
    errors: errors.slice(0, 30),
  };
  writeFileSync(logPath, JSON.stringify(log, null, 2));

  // Step 6: Summary
  console.log('\n=== DONE ===');
  console.log(`Total stubs fetched:   ${stubs.length}`);
  console.log(`Filtered as FMS:       ${fmsStubs.length}`);
  console.log(`Successfully parsed:   ${notifications.length}`);
  console.log(`Parse/fetch errors:    ${errors.length}`);
  console.log(`Output:                ${outPath}`);
  console.log(`Log:                   ${logPath}`);

  if (notifications.length > 0) {
    console.log('\n--- First 5 records ---');
    notifications.slice(0, 5).forEach((n, i) => {
      console.log(`\n[${i + 1}] ${n.date}  |  Transmittal: ${n.transmittal}`);
      console.log(`    Country:    ${n.country}`);
      console.log(`    System:     ${n.system}`);
      console.log(`    Cost:       ${n.costUSD != null ? '$' + n.costUSD.toLocaleString() : 'null'}`);
      console.log(`    Contractor: ${n.contractor}`);
      console.log(`    Location:   ${n.contractorLocation}`);
      console.log(`    Source:     ${n._source}`);
    });
  }
}

main().catch((err) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
