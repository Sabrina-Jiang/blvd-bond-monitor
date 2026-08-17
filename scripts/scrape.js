const fs = require('fs');
const path = require('path');
const { scrapeAllUnits } = require('../src/scraper');

const DATA_DIR = path.join(__dirname, '..', 'docs', 'data');
const UNITS_FILE = path.join(DATA_DIR, 'units.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const META_FILE = path.join(DATA_DIR, 'meta.json');

const MAX_EVENTS = 500;
const MAX_PRICE_HISTORY_PER_UNIT = 400; // one point/day covers well over a year

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

// Appends a price point, but only one per calendar day — updates today's
// point in place if we already recorded one today, so the series stays a
// clean daily series even with hourly scrapes.
function recordPricePoint(priceHistory, price, now) {
  if (price == null) return priceHistory;
  const todayKey = now.slice(0, 10);
  const last = priceHistory[priceHistory.length - 1];
  if (last && last.at.slice(0, 10) === todayKey) {
    last.price = price;
    last.at = now;
  } else {
    priceHistory.push({ price, at: now });
    if (priceHistory.length > MAX_PRICE_HISTORY_PER_UNIT) priceHistory.shift();
  }
  return priceHistory;
}

async function main() {
  const now = new Date().toISOString();
  const scraped = await scrapeAllUnits();

  const prevUnits = readJson(UNITS_FILE, []);
  const prevById = new Map(prevUnits.map((u) => [u.unitId, u]));
  const events = readJson(EVENTS_FILE, []);

  const nextUnits = [];
  const seenIds = new Set();
  let newCount = 0;
  let priceChangeCount = 0;
  const newEvents = [];

  for (const u of scraped) {
    seenIds.add(u.unitId);
    const existing = prevById.get(u.unitId);

    if (!existing) {
      nextUnits.push({
        ...u,
        firstSeenAt: now,
        lastSeenAt: now,
        priceHistory: recordPricePoint([], u.price, now),
      });
      newEvents.push({ detectedAt: now, unitId: u.unitId, type: 'new_unit', oldValue: null, newValue: u });
      newCount++;
      continue;
    }

    const priceHistory = recordPricePoint(existing.priceHistory || [], u.price, now);

    if (existing.price !== u.price && u.price != null) {
      newEvents.push({
        detectedAt: now,
        unitId: u.unitId,
        type: u.price > existing.price ? 'price_increase' : 'price_decrease',
        oldValue: existing.price,
        newValue: u.price,
      });
      priceChangeCount++;
    }

    if (existing.available !== u.available) {
      newEvents.push({
        detectedAt: now,
        unitId: u.unitId,
        type: 'availability_change',
        oldValue: existing.available,
        newValue: u.available,
      });
    }

    nextUnits.push({
      ...u,
      firstSeenAt: existing.firstSeenAt,
      lastSeenAt: now,
      priceHistory,
    });
  }

  let removedCount = 0;
  for (const [id, existing] of prevById) {
    if (!seenIds.has(id)) {
      newEvents.push({ detectedAt: now, unitId: id, type: 'removed_unit', oldValue: existing, newValue: null });
      removedCount++;
    }
  }

  nextUnits.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));

  const allEvents = [...newEvents, ...events].slice(0, MAX_EVENTS);

  writeJson(UNITS_FILE, nextUnits);
  writeJson(EVENTS_FILE, allEvents);
  writeJson(META_FILE, {
    lastRunAt: now,
    unitCount: nextUnits.length,
    newCount,
    removedCount,
    priceChangeCount,
  });

  console.log(`Scrape complete: ${nextUnits.length} units (${newCount} new, ${removedCount} removed, ${priceChangeCount} price changes)`);
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
