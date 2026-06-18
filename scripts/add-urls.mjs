/**
 * Fetches html_url for each notification from the Federal Register API
 * and saves updated JSON with sourceUrl field.
 */
import fetch from 'node-fetch';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_FILE = resolve(ROOT, 'data/fms_notifications.json');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJSON(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FMS-Research/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const data = JSON.parse(readFileSync(DATA_FILE, 'utf8'));

// Group by date
const byDate = new Map();
for (let i = 0; i < data.length; i++) {
  const d = data[i].date;
  if (!byDate.has(d)) byDate.set(d, []);
  byDate.get(d).push(i);
}

const uniqueDates = [...byDate.keys()].sort();
console.log(`Processing ${uniqueDates.length} unique dates, ${data.length} total notifications...`);

let updated = 0;

for (const date of uniqueDates) {
  const indices = byDate.get(date);

  try {
    // Fetch all arms-sales articles on this date (Defense Dept, agency 103)
    const url = `https://www.federalregister.gov/api/v1/articles.json` +
      `?conditions[agency_ids][]=103` +
      `&conditions[term]=arms+sales+notification` +
      `&conditions[publication_date][is]=${date}` +
      `&fields[]=html_url&fields[]=abstract&fields[]=title` +
      `&per_page=50`;

    const json = await fetchJSON(url);
    const articles = json.results ?? [];

    if (articles.length === 0) {
      // No articles found for this date — skip
      continue;
    }

    for (const idx of indices) {
      const transmittal = data[idx].transmittal;
      if (!transmittal) {
        // No transmittal — assign first article
        data[idx].sourceUrl = articles[0].html_url;
        updated++;
        continue;
      }

      // Try to match by transmittal number in abstract
      const match = articles.find(a =>
        (a.abstract ?? '').includes(transmittal) ||
        (a.title ?? '').includes(transmittal)
      );

      if (match) {
        data[idx].sourceUrl = match.html_url;
      } else if (articles.length === 1) {
        // Only one article on this date, assign it
        data[idx].sourceUrl = articles[0].html_url;
      } else {
        // Couldn't match — use first article as fallback
        data[idx].sourceUrl = articles[0].html_url;
      }
      updated++;
    }
  } catch (e) {
    console.warn(`  [${date}] Error: ${e.message}`);
  }

  await sleep(200);
}

console.log(`\nDone. ${updated}/${data.length} notifications updated with sourceUrl.`);

// Verify a few samples
const withUrl = data.filter(n => n.sourceUrl);
console.log(`Sample URLs:`);
withUrl.slice(0, 3).forEach(n => console.log(`  [${n.date}] ${n.transmittal} → ${n.sourceUrl}`));

writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
console.log('Saved to data/fms_notifications.json');
