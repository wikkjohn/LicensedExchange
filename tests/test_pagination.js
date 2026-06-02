const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

function initScript() {
  let idc = 1;
  const uuid = (p) => `${p}000-0000-4000-8000-${String(idc++).padStart(12, '0')}`;
  // Seed 30 public listings (more than one 24-item page).
  const listings = [];
  for (let i = 0; i < 30; i++) {
    listings.push({
      id: uuid('bbbb'), owner_id: uuid('aaaa'), business_name: 'Biz ' + String(i).padStart(2, '0'),
      license_type: 'cultivator', license_number: 'LIC-' + i, city: 'Town', state: 'New York',
      contact_name: 'X', contact_email: 'x@x.com', sells: [], buys: [], image_url: null,
      created_at: new Date(2026, 0, 1, 0, i).toISOString()
    });
  }
  // newest first to mimic order desc
  listings.reverse();
  const db = { users: [], profiles: [], listings, conversations: [], messages: [], saved_partners: [] };
  window.__db = db;
  window.__rangeCalls = [];
  let session = null;

  const ilikeRe = (p) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
  function builder(table) {
    const st = { table, op: 'select', payload: null, eqs: [], neqs: [], ins: [], ilikes: [], ors: [], from: null, to: null };
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
    function exec() {
      if (st.op === 'select') return { data: rows(), error: null };
      return { data: [], error: null };
    }
    const api = {
      select() { return api; }, insert() { return api; }, upsert() { return api; },
      update() { return api; }, eq(c, v) { st.eqs.push({ col: c, val: v }); return api; },
      neq(c, v) { st.neqs.push({ col: c, val: v }); return api; },
      ilike(c, p) { st.ilikes.push({ col: c, pat: p }); return api; },
      or(e) { st.ors.push(String(e).split(',').map(c => { const p = c.split('.'); return { col: p[0], op: p[1], pat: p.slice(2).join('.') }; })); return api; },
      in(c, a) { st.ins.push({ col: c, arr: a }); return api; }, order() { return api; }, limit() { return api; },
      range(f, t) { st.from = f; st.to = t; if (table === 'listings') window.__rangeCalls.push([f, t]); return api; },
      single() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
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
  const cardCount = () => page.evaluate(() => document.querySelectorAll('#listingsGrid .air-card').length);
  const rangeCalls = () => page.evaluate(() => window.__rangeCalls.slice());
  const loadMoreVisible = () => page.evaluate(() => !!document.querySelector('#listingsLoadMore button'));

  // First page only
  let rc = await rangeCalls();
  rec('First load uses .range()', rc.length >= 1 && JSON.stringify(rc[0]) === JSON.stringify([0, 23]), JSON.stringify(rc));
  rec('Only first page rendered (24 cards)', (await cardCount()) === 24, 'cards=' + (await cardCount()));
  rec('Load more button visible (more remain)', await loadMoreVisible());

  // Click load more → second page
  await page.$eval('#listingsLoadMore button', el => el.click());
  await page.waitForTimeout(300);
  rc = await rangeCalls();
  rec('Load more fetches next page [24,47]', rc.some(c => JSON.stringify(c) === JSON.stringify([24, 47])), JSON.stringify(rc));
  rec('All 30 cards rendered after load more', (await cardCount()) === 30, 'cards=' + (await cardCount()));
  rec('Load more hidden when exhausted', (await loadMoreVisible()) === false);

  rec('No page errors', errs.length === 0, errs.join(' | '));

  console.log('\n===== PAGINATION TEST =====');
  let pass = 0;
  for (const r of results) { console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.p ? '' : '  →  ' + r.d}`); if (r.p) pass++; }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
