const cheerio = require('cheerio');

const BASE = 'https://www.blvdbond.com';
const LISTING_URL = `${BASE}/floor-plans/apartments/`;
const AJAX_URL = `${BASE}/wp-content/themes/blvd-and-bond-theme/floorplan-ajax-listing-page.php`;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Parses a single `.fp-unit` block into a plain object.
function parseUnitEl($, el) {
  const $el = $(el);
  const unitId = $el.find('.unit-title').first().text().trim();
  const infos = $el.find('> .unit-info');
  const address = $(infos[0]).clone().children().remove().end().text().trim();
  const typeLine = $(infos[1]).text().trim(); // e.g. "Studio - 1 BA - 641 sqft"

  const feeLink = $el.find('a.rfwa-fee-calculator').first();
  const priceRaw = feeLink.attr('data-price') || '';
  const price = priceRaw ? Number(priceRaw.replace(/[^0-9.]/g, '')) : null;
  const available = (feeLink.attr('data-available') || '').trim();
  const floorplanName = feeLink.attr('data-fp-name') || '';

  const applyLink = $el.find('a.apply-btn').first();
  const sqftAttr = applyLink.attr('data-sqft') || feeLink.attr('data-area');
  const sqftMatch = typeLine.match(/(\d+)\s*sqft/i);
  const sqft = sqftAttr ? Number(sqftAttr) : sqftMatch ? Number(sqftMatch[1]) : null;
  const applyUrl = applyLink.attr('href') || '';
  const unitIdMatch = applyUrl.match(/UnitID=(\d+)/);
  const externalUnitId = unitIdMatch ? unitIdMatch[1] : null;

  const detailUrl = $el.find('a.view-detail-btn').first().attr('href') || '';
  const imageUrl = $el.find('.fp-img img').first().attr('src') || '';

  const bedroomMatch = typeLine.match(/^(Studio|\d+\s*BR)/i);
  const bedrooms = bedroomMatch ? bedroomMatch[1].trim() : null;

  return {
    unitId,
    externalUnitId,
    address,
    typeLine,
    bedrooms,
    floorplanName,
    sqft,
    price,
    available,
    applyUrl,
    detailUrl,
    imageUrl,
  };
}

function parseUnits(html) {
  const $ = cheerio.load(html);
  const units = [];
  $('.fp-unit').each((_, el) => {
    const unit = parseUnitEl($, el);
    if (unit.unitId) units.push(unit);
  });
  return units;
}

async function fetchHtml(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    ...opts,
  });
  if (!res.ok) throw new Error(`Request failed ${res.status} for ${url}`);
  return res.text();
}

// Scrapes every listed unit across all "load more" pages.
async function scrapeAllUnits() {
  const page1Html = await fetchHtml(LISTING_URL);
  const units = parseUnits(page1Html);

  const $ = cheerio.load(page1Html);
  const totalPages = Number($('#hidden_total_pages').val() || '1');
  const sort = $('#hidden_sort').val() || 'unitrent';
  const order = $('#hidden_order').val() || 'ASC';

  for (let page = 2; page <= totalPages; page++) {
    const body = new URLSearchParams({
      bedroom: '',
      building: '',
      maxprice: '',
      sort,
      order,
      page: String(page),
    });
    const raw = await fetchHtml(AJAX_URL, { method: 'POST', body, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' } });
    let html;
    try {
      html = JSON.parse(raw);
    } catch {
      html = raw;
    }
    units.push(...parseUnits(html));
  }

  return units;
}

module.exports = { scrapeAllUnits, parseUnits };
