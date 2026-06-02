const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

function initScript() {
  let idc = 1;
  const uuid = (p) => `${p}000-0000-4000-8000-${String(idc++).padStart(12, '0')}`;
  const mk = (name, type, city) => ({
    id: uuid('bbbb'), owner_id: uuid('aaaa'), business_name: name, license_type: type,
    license_number: 'L' + idc, city, state: 'New York', contact_name: 'X', contact_email: 'x@x.com',
    sells: [], buys: [], image_url: null, created_at: new Date(2026, 0, idc).toISOString()
  });
  const listings = [
    mk('Green Valley Farms', 'cultivator', 'Albany'),
    mk('Sunrise Dispensary', 'Adult-Use Retail Dispensary License', 'Buffalo'),
    mk('Hudson Processing', 'processor', 'Kingston'),
    mk('Brooklyn Botanicals', 'cultivator', 'Brooklyn'),
    mk('Empire Dispensary', 'dispensary', 'Rochester')
  ];
  const db = { users: [], profiles: [], listings, conversations: [], messages: [], saved_partners: [] };
  window.__db = db;
  window.__queries = []; // record what filters each listings query used
  let session = null;
  const ilikeRe = (p) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');

  function builder(table) {
    const st = { table, op: 'select', eqs: [], neqs: [], ins: [], ilikes: [], ors: [], from: null, to: null };
    function rows() {
      let r = db[table] ? db[table].slice() : [];
      st.eqs.forEach(f => { r = r.filter(x => String(x[f.col]) === String(f.val)); });
      st.neqs.forEach(f => { r = r.filter(x => String(x[f.col]) !== String(f.val)); });
      st.ins.forEach(f => { r = r.filter(x => f.arr.map(String).includes(String(x[f.col]))); });
      st.ilikes.forEach(f => { const re = ilikeRe(f.pat); r = r.filter(x => re.test(String(x[f.col] == null ? '' : x[f.col]))); });
      st.ors.forEach(g => { r = r.filter(x => g.some(c => ilikeRe(c.pat).test(String(x[c.col] == null ? '' : x[c.col])))); });
      if (st.from != null) r = r.slice(st.from, (st.to != null ? st.to : r.length - 1) + 1);
      return r;
    }
    const api = {
      select() { return api; }, insert() { return api; }, upsert() { return api; }, update() { return api; },
      eq(c, v) { st.eqs.push({ col: c, val: v }); return api; },
      neq(c, v) { st.neqs.push({ col: c, val: v }); return api; },
      ilike(c, p) { st.ilikes.push({ col: c, pat: p }); return api; },
      or(e) { st.ors.push(String(e).split(',').map(c => { const p = c.split('.'); return { col: p[0], op: p[1], pat: p.slice(2).join('.') }; })); return api; },
      in(c, a) { st.ins.push({ col: c, arr: a }); return api; }, order() { return api; }, limit() { return api; },
      range(f, t) { st.from = f; st.to = t; if (table === 'listings') window.__queries.push({ ilikes: st.ilikes.slice(), ors: st.ors.slice(), neqs: st.neqs.slice(), range: [f, t] }); return api; },
      single() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve({ data: rows(), error: null }).then(res, rej); }
    };
    return api;
  }
  const client = {
    auth: {
      async getUser() { return { data: { user: session ? session.user : null }, error: null }; },
      async getSession() { return { data: { session }, error: null }; },
      onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
      async signOut() { session = null; return { error: null }; }
    },
    from(t) { return builder(t); },
    storage: { from() { return { async upload() { return { error: null }; }, getPublicUrl() { return { data: { publicUrl: 'x' } }; } }; } }
  };
  window.supabase = { createClient: () => client };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.addInitScript(initScript);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  const results = [];
  const rec = (n, p, d) => results.push({ n, p, d: d || '' });
  const cardNames = () => page.evaluate(() => Array.from(document.querySelectorAll('#listingsGrid .air-card .air-card-title, #listingsGrid .air-card')).map(e => e.textContent));
  const gridText = () => page.evaluate(() => document.getElementById('listingsGrid').textContent);
  const lastQuery = () => page.evaluate(() => window.__queries[window.__queries.length - 1]);
  const clearQ = () => page.evaluate(() => { window.__queries = []; });

  // Baseline: all 5 visible
  rec('Baseline shows all listings', /Green Valley|Sunrise|Hudson|Brooklyn|Empire/.test(await gridText()) && (await page.evaluate(() => document.querySelectorAll('#listingsGrid .air-card').length)) === 5,
    'cards=' + (await page.evaluate(() => document.querySelectorAll('#listingsGrid .air-card').length)));

  // --- Search "sunrise" → server or() with ilike, only Sunrise shows ---
  await clearQ();
  await page.fill('#searchInput', 'sunrise');
  await page.waitForTimeout(500); // debounce + fetch
  let q = await lastQuery();
  rec('Search issues server or(ilike) query', !!q && q.ors.length > 0 && /sunrise/i.test(JSON.stringify(q.ors)), JSON.stringify(q && q.ors));
  let txt = await gridText();
  rec('Search result contains Sunrise only', /Sunrise/.test(txt) && !/Green Valley|Hudson|Brooklyn|Empire/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 120));

  // --- Clear search → back to all ---
  await page.$eval('#searchClearBtn', el => el.click());
  await page.waitForTimeout(500);
  rec('Clear search restores all', (await page.evaluate(() => document.querySelectorAll('#listingsGrid .air-card').length)) === 5);

  // --- Filter chip "dispensary" → server ilike on license_type, matches both dispensary variants ---
  await clearQ();
  await page.$eval('.chip[onclick*="setFilter(\'dispensary\'"]', el => el.click());
  await page.waitForTimeout(500);
  q = await lastQuery();
  rec('Filter issues server ilike(license_type) query', !!q && q.ilikes.some(i => i.col === 'license_type' && /dispensary/i.test(i.pat)), JSON.stringify(q && q.ilikes));
  txt = await gridText();
  rec('Filter matches both dispensary variants (Sunrise + Empire)', /Sunrise/.test(txt) && /Empire/.test(txt) && !/Green Valley|Hudson|Brooklyn/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 140));

  // --- Combine filter + search: with dispensary filter, search "empire" ---
  await clearQ();
  await page.fill('#searchInput', 'empire');
  await page.waitForTimeout(500);
  q = await lastQuery();
  rec('Combined query has both ilike(filter) and or(search)', !!q && q.ilikes.some(i => /dispensary/i.test(i.pat)) && q.ors.length > 0, JSON.stringify(q));
  txt = await gridText();
  rec('Combined result = Empire only', /Empire/.test(txt) && !/Sunrise|Green Valley|Hudson|Brooklyn/.test(txt), txt.replace(/\s+/g, ' ').slice(0, 120));

  rec('No page errors', errs.length === 0, errs.join(' | '));

  console.log('\n===== SERVER SEARCH/FILTER TEST =====');
  let pass = 0;
  for (const r of results) { console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.p ? '' : '  →  ' + r.d}`); if (r.p) pass++; }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
