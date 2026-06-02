const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

// Regression: the dashboard "Open" button must open the conversation even when
// the partner's listing is not in the loaded browse page (listings paginate, so
// a partner you've messaged may live on a later page and never enter allListings).
// Also checks that for an owner running multiple stores, Open loads the thread for
// the store that conversation actually belongs to.
function initScript(scn) {
    let idc = 1;
    const uuid = (p) => `${p}-0000-4000-8000-${String(idc++).padStart(12, '0')}`;
    const OWNER = uuid('1111'), STORE_A = uuid('aaaa'), STORE_B = uuid('bbbb');
    const KENZIE_OWNER = uuid('2222'), KENZIE = uuid('cccc'), CONV = uuid('dddd');
    const multi = scn === 'multi';
    // In the multi-store scenario the conversation belongs to STORE_B (the 2nd store).
    const myListingInConv = multi ? STORE_B : STORE_A;
    const sorted = [myListingInConv, KENZIE].sort();
    const listings = [
      { id: STORE_A, owner_id: OWNER, business_name: 'My Store', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York', contact_name: 'Sam', contact_email: 'o@s.com', sells: [], buys: [], image_url: null, created_at: '2026-01-01T00:00:00Z' },
      { id: KENZIE, owner_id: KENZIE_OWNER, business_name: "kenzie's kreations", license_type: 'cultivator', license_number: 'LIC-K', city: 'Kingston', state: 'New York', contact_name: 'Kenz', contact_email: 'k@k.com', sells: ['Flower'], buys: [], image_url: null, created_at: '2026-01-02T00:00:00Z' }
    ];
    if (multi) listings.splice(1, 0, { id: STORE_B, owner_id: OWNER, business_name: 'Second Store', license_type: 'dispensary', license_number: 'LIC-B', city: 'Buffalo', state: 'New York', contact_name: 'Sam', contact_email: 'o@s.com', sells: [], buys: [], image_url: null, created_at: '2026-01-03T00:00:00Z' });
    const db = {
      users: [{ id: OWNER, email: 'o@s.com', password: 'StrongP@ss1' }],
      profiles: [{ id: OWNER, business_name: 'My Store', email: 'o@s.com', contact_name: 'Sam', contact_email: 'o@s.com', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York' }],
      listings,
      conversations: [{ id: CONV, listing_a_id: sorted[0], listing_b_id: sorted[1], created_by: OWNER }],
      messages: [{ id: uuid('eeee'), conversation_id: CONV, sender_id: KENZIE_OWNER, body: 'Hi MKenz. Have you tried to add products?', created_at: '2026-02-01T00:00:00Z' }],
      saved_partners: []
    };
    window.__db = db;
    window.__ids = { OWNER, STORE_A, STORE_B, KENZIE, CONV, myListingInConv };
    window.__browseExclude = [STORE_A, STORE_B, KENZIE]; // partner lives on a later page
    let session = { user: { id: OWNER, email: 'o@s.com' } };
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
        if (table === 'listings' && st.from != null) r = r.filter(x => !window.__browseExclude.map(String).includes(String(x.id)));
        if (st.from != null) r = r.slice(st.from, (st.to != null ? st.to : r.length - 1) + 1);
        return r;
      }
      function exec() {
        if (st.op === 'select') return { data: rows(), error: null };
        if (st.op === 'insert') { const arr = Array.isArray(st.payload) ? st.payload : [st.payload]; const ins = arr.map(p => { const row = { ...p }; if (row.id == null) row.id = uuid('ffff'); if (row.created_at == null) row.created_at = new Date().toISOString(); db[table].push(row); return row; }); return { data: ins, error: null }; }
        if (st.op === 'upsert') { const arr = Array.isArray(st.payload) ? st.payload : [st.payload]; arr.forEach(p => { const ex = db[table].find(x => String(x.id) === String(p.id)); if (ex) Object.assign(ex, p); else db[table].push({ ...p }); }); return { data: arr, error: null }; }
        return { data: [], error: null };
      }
      const api = {
        select() { return api; }, insert(p) { st.op = 'insert'; st.payload = p; return api; }, upsert(p) { st.op = 'upsert'; st.payload = p; return api; }, update() { return api; },
        eq(c, v) { st.eqs.push({ col: c, val: v }); return api; }, neq(c, v) { st.neqs.push({ col: c, val: v }); return api; },
        ilike(c, p) { st.ilikes.push({ col: c, pat: p }); return api; },
        or(e) { st.ors.push(String(e).split(',').map(c => { const p = c.split('.'); return { col: p[0], op: p[1], pat: p.slice(2).join('.') }; })); return api; },
        in(c, a) { st.ins.push({ col: c, arr: a }); return api; }, order() { return api; }, limit() { return api; }, range(f, t) { st.from = f; st.to = t; return api; },
        single() { const r = exec(); return Promise.resolve(r.error ? r : { data: (r.data || [])[0] || null, error: null }); },
        maybeSingle() { const r = exec(); return Promise.resolve(r.error ? r : { data: (r.data || [])[0] || null, error: null }); },
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

async function runScenario(scenario) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.addInitScript(initScript, scenario);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(async () => { window.eval('authRestoreInFlight=null'); await restoreSessionFromSupabase({ preserveView: true }); });
  await page.waitForTimeout(400);

  const results = [];
  const rec = (n, p, d) => results.push({ scenario, n, p, d: d || '' });

  // Precondition: partner is genuinely NOT loaded in the browse catalog.
  const notLoaded = await page.evaluate(() => !allListings.some(b => String(b.id) === String(window.__ids.KENZIE)));
  rec('Partner not in loaded listings (precondition)', notLoaded);

  // Click "Open" exactly as the dashboard message item does.
  await page.evaluate(() => openChatByPartnerId(window.__ids.KENZIE));
  await page.waitForTimeout(500);

  const state = await page.evaluate(() => ({
    open: document.getElementById('chatModal').classList.contains('open'),
    header: document.getElementById('chatPartnerName').textContent,
    body: document.getElementById('chatMessages').innerText.trim(),
    acting: getActingListingId()
  }));
  rec('Open opens the chat modal', state.open, 'open=' + state.open);
  rec('Header shows partner name', state.header === "kenzie's kreations", state.header);
  rec('Conversation thread loads (not stuck on Loading)', /Hi MKenz/.test(state.body) && !/Loading conversation/.test(state.body), state.body);

  if (scenario === 'multi') {
    rec('Acts as the store that owns this conversation', String(state.acting) === String(await page.evaluate(() => window.__ids.myListingInConv)), 'acting=' + state.acting);
  }

  rec('No page errors', errs.length === 0, errs.join(' | '));
  await browser.close();
  return results;
}

(async () => {
  const all = [...await runScenario('single'), ...await runScenario('multi')];
  console.log('\n===== DASHBOARD "OPEN" CONVERSATION TEST =====');
  let pass = 0;
  for (const r of all) { console.log(`${r.p ? 'PASS' : 'FAIL'}  [${r.scenario}] ${r.n}${r.p ? '' : '  →  ' + r.d}`); if (r.p) pass++; }
  console.log(`\n${pass}/${all.length} passed`);
  process.exit(pass === all.length ? 0 : 1);
})();
