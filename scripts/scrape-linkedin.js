const RAPIDAPI_KEY  = process.env.RAPIDAPI_KEY;
const SUPABASE_URL  = 'https://crktlztfsyqbwnguqqjl.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_KEY;

async function run() {
  // Fetch follower count from RapidAPI
  const liRes = await fetch(
    'https://fresh-linkedin-profile-data.p.rapidapi.com/get-company-by-linkedinurl?linkedin_url=https%3A%2F%2Fwww.linkedin.com%2Fcompany%2Felan-advisors%2F',
    {
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': 'fresh-linkedin-profile-data.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    }
  );

  if (!liRes.ok) throw new Error(`RapidAPI error: ${liRes.status} ${await liRes.text()}`);

  const { data } = await liRes.json();
  const followers = data.follower_count;
  if (followers == null) throw new Error('follower_count missing from response');
  console.log(`Followers: ${followers}`);

  // Fetch current Supabase row so we don't overwrite other keys
  const getRes = await fetch(
    `${SUPABASE_URL}/rest/v1/mandala?id=eq.1&select=data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await getRes.json();
  const state = (rows && rows.length > 0 && rows[0].data) ? rows[0].data : {};

  // Update only the linkedin KPI
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  state.__kpi_linkedin = { value: followers, date: today };

  // Upsert back
  const putRes = await fetch(`${SUPABASE_URL}/rest/v1/mandala`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ id: 1, data: state }),
  });

  if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
    throw new Error(`Supabase write failed: ${await putRes.text()}`);
  }

  console.log(`Supabase updated — ${followers} followers as of ${today}`);
}

run().catch(err => { console.error(err); process.exit(1); });
