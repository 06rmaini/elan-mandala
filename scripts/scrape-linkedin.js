const puppeteer = require('puppeteer');

const LINKEDIN_EMAIL    = process.env.LINKEDIN_EMAIL;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;
const SUPABASE_URL      = 'https://crktlztfsyqbwnguqqjl.supabase.co';
const SUPABASE_KEY      = process.env.SUPABASE_KEY;
const COMPANY_URL       = 'https://www.linkedin.com/company/elan-advisors/';

async function run() {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  // Log in
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'networkidle2' });
  await page.type('#username', LINKEDIN_EMAIL, { delay: 60 });
  await page.type('#password', LINKEDIN_PASSWORD, { delay: 60 });
  await page.click('[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Go to company page
  await page.goto(COMPANY_URL, { waitUntil: 'networkidle2' });

  // Extract follower count — LinkedIn renders it in a variety of elements; try several selectors
  const followers = await page.evaluate(() => {
    // "X followers" appears in a <p> or <div> near the top of the company page
    const candidates = [
      ...document.querySelectorAll('p, span, div, h3'),
    ];
    for (const el of candidates) {
      const txt = el.textContent.trim();
      const m = txt.match(/^([\d,]+)\s+follower/i);
      if (m) return m[1].replace(/,/g, '');
    }
    return null;
  });

  await browser.close();

  if (!followers) throw new Error('Could not find follower count on page');

  console.log(`Followers: ${followers}`);

  // Fetch current Supabase row
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/mandala?id=eq.1&select=data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await getRes.json();
  const data = (rows && rows.length > 0 && rows[0].data) ? rows[0].data : {};

  // Merge updated KPI
  const today = new Date().toISOString().slice(0, 10);
  data.__kpi_linkedin = { value: Number(followers), date: today };

  // Upsert back
  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/mandala`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: 1, data }),
  });

  if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
    throw new Error(`Supabase write failed: ${await putRes.text()}`);
  }

  console.log('Supabase updated successfully');
}

run().catch(err => { console.error(err); process.exit(1); });
