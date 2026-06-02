const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

// One owner (one email) with TWO listings/licenses, plus an external partner.
function initScript() {
  let idc = 1;
  const uuid = (p) => `${p}00-0000-4000-8000-${String(idc++).padStart(12, '0')}`;
  const OWNER = uuid('1111');
  const STORE_A = uuid('aaaa');
  const STORE_B = uuid('bbbb');
  const PARTNER_OWNER = uuid('2222');
  const PARTNER = uuid('cccc');
  const db = {
    users: [{ id: OWNER, email: 'owner@stores.com', password: 'StrongP@ss1' }],
    profiles: [
      { id: OWNER, business_name: 'Store A', email: 'owner@stores.com', contact_name: 'Sam', contact_email: 'owner@stores.com', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York' },
      { id: PARTNER_OWNER, business_name: 'Wholesale Partner', email: 'p@p.com', contact_name: 'Pat', contact_email: 'p@p.com', license_type: 'cultivator', license_number: 'LIC-P', city: 'Kingston', state: 'New York' }
    ],
    listings: [
      { id: STORE_A, owner_id: OWNER, business_name: 'Store A', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York', contact_name: 'Sam', contact_email: 'owner@stores.com', sells: [], buys: [], image_url: null, created_at: '2026-01-01T00:00:00Z' },
      { id: STORE_B, owner_id: OWNER, business_name: 'Store B', license_type: 'dispensary', license_number: 'LIC-B', city: 'Buffalo', state: 'New York', contact_name: 'Sam', contact_email: 'owner@stores.com', sells: [], buys: [], image_url: null, created_at: '2026-01-02T00:00:00Z' },
      { id: PARTNER, owner_id: PARTNER_OWNER, business_name: 'Wholesale Partner', license_type: 'cultivator', license_number: 'LIC-P', city: 'Kingston', state: 'New York', contact_name: 'Pat', contact_email: 'p@p.com', sells: ['Flower'], buys: [], image_url: null, created_at: '2026-01-03T00:00:00Z' }
    ],
    conversations: [], messages: [], saved_partners: []
  };
  window.__db = db;
  window.__ids = { OWNER, STORE_A, STORE_B, PARTNER };
  let session = { user: { id: OWNER, email: 'owner@stores.com' } }; // start logged in
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
      if (st.op === 'insert') {
        const arr = Array.isArray(st.payload) ? st.payload : [st.payload];
        const ins = arr.map(p => { const row = { ...p }; if (row.id == null) row.id = uuid('eeee'); if (row.created_at == null) row.created_at = new Date().toISOString(); db[table].push(row); return row; });
        return { data: ins, error: null };
      }
      if (st.op === 'upsert') {
        const arr = Array.isArray(st.payload) ? st.payload : [st.payload];
        arr.forEach(p => { const ex = db[table].find(x => String(x.id) === String(p.id)); if (ex) Object.assign(ex, p); else db[table].push({ ...p }); });
        return { data: arr, error: null };
      }
      return { data: [], error: null };
    }
    const api = {
      select() { return api; }, insert(p) { st.op = 'insert'; st.payload = p; return api; },
      upsert(p) { st.op = 'upsert'; st.payload = p; return api; }, update() { return api; },
      eq(c, v) { st.eqs.push({ col: c, val: v }); return api; }, neq(c, v) { st.neqs.push({ col: c, val: v }); return api; },
      ilike(c, p) { st.ilikes.push({ col: c, pat: p }); return api; },
      or(e) { st.ors.push(String(e).split(',').map(c => { const p = c.split('.'); return { col: p[0], op: p[1], pat: p.slice(2).join('.') }; })); return api; },
      in(c, a) { st.ins.push({ col: c, arr: a }); return api; }, order() { return api; }, limit() { return api; },
      range(f, t) { st.from = f; st.to = t; return api; },
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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.addInitScript(initScript);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  // restore session (logged-in owner with 2 listings)
  await page.evaluate(async () => { window.eval('authRestoreInFlight=null'); await restoreSessionFromSupabase({ preserveView: true }); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); if (o) try { o(m); } catch (e) {} }; });

  const results = [];
  const rec = (n, p, d) => results.push({ n, p, d: d || '' });
  const isOpen = (id) => page.evaluate(i => document.getElementById(i)?.classList.contains('open'), id);

  // sanity: owner has 2 listings
  rec('Owner has two listings', await page.evaluate(() => getUserListings().length === 2), 'count=' + (await page.evaluate(() => getUserListings().length)));

  // open chat with the partner
  await page.evaluate(() => { const id = window.__ids.PARTNER; openChatByPartnerId(id); });
  await page.waitForTimeout(300);
  rec('Chat modal opens', await isOpen('chatModal'));

  // sender bar visible with both stores
  rec('Sender bar visible (2 stores)', await page.evaluate(() => document.getElementById('chatSenderBar').style.display !== 'none'));
  const opts = await page.evaluate(() => Array.from(document.querySelectorAll('#chatSenderSelect option')).map(o => o.textContent));
  rec('Sender dropdown lists both stores', opts.includes('Store A') && opts.includes('Store B'), JSON.stringify(opts));

  // Act as Store A → send a message
  await page.evaluate(async () => {
    document.getElementById('chatSenderSelect').value = window.__ids.STORE_A;
    await onChatSenderChange();
    document.getElementById('chatInputField').value = 'Hi from Store A';
    await sendMessage();
  });
  await page.waitForTimeout(300);

  // Switch to Store B → send a message
  await page.evaluate(async () => {
    document.getElementById('chatSenderSelect').value = window.__ids.STORE_B;
    await onChatSenderChange();
    document.getElementById('chatInputField').value = 'Hi from Store B';
    await sendMessage();
  });
  await page.waitForTimeout(300);

  // Two distinct conversations should exist, keyed by each store + partner
  const convo = await page.evaluate(() => {
    const { STORE_A, STORE_B, PARTNER } = window.__ids;
    const has = (a, b) => window.__db.conversations.some(c =>
      [c.listing_a_id, c.listing_b_id].sort().join('|') === [a, b].sort().join('|'));
    return { total: window.__db.conversations.length, aWithPartner: has(STORE_A, PARTNER), bWithPartner: has(STORE_B, PARTNER), messages: window.__db.messages.length };
  });
  rec('Two separate conversations created', convo.total === 2, JSON.stringify(convo));
  rec('Store A↔Partner conversation exists', convo.aWithPartner);
  rec('Store B↔Partner conversation exists', convo.bWithPartner);
  rec('Both messages persisted', convo.messages === 2, 'messages=' + convo.messages);

  // Each message attributed to the correct sender conversation
  const attribution = await page.evaluate(() => {
    const { STORE_A, STORE_B, PARTNER } = window.__ids;
    const convOf = (a, b) => window.__db.conversations.find(c => [c.listing_a_id, c.listing_b_id].sort().join('|') === [a, b].sort().join('|'));
    const cA = convOf(STORE_A, PARTNER), cB = convOf(STORE_B, PARTNER);
    const bodyIn = (conv) => conv ? window.__db.messages.filter(m => m.conversation_id === conv.id).map(m => m.body) : [];
    return { a: bodyIn(cA), b: bodyIn(cB), convDump: window.__db.conversations.map(c => ({ a: c.listing_a_id, b: c.listing_b_id })) };
  });
  rec('Store A message in Store A thread', attribution.a.includes('Hi from Store A'), JSON.stringify(attribution.a));
  rec('Store B message in Store B thread', attribution.b.includes('Hi from Store B'), JSON.stringify(attribution.b));

  rec('No page errors', errs.length === 0, errs.join(' | '));

  console.log('\n===== MULTI-LISTING MESSAGING TEST =====');
  let pass = 0;
  for (const r of results) { console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.p ? '' : '  →  ' + r.d}`); if (r.p) pass++; }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
