const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

// The "Edit Business Information" popup for the main business must let the owner
// edit the products they sell and buy — same as the "Edit Active Listing" popup —
// and persist them to the listing row.
function initScript() {
  let idc = 1;
  const uuid = (p) => `${p}-0000-4000-8000-${String(idc++).padStart(12, '0')}`;
  const OWNER = uuid('1111'), MY_STORE = uuid('aaaa');
  const db = {
    users: [{ id: OWNER, email: 'o@s.com', password: 'StrongP@ss1' }],
    profiles: [{ id: OWNER, business_name: 'My Store', email: 'o@s.com', contact_name: 'Sam', contact_email: 'o@s.com', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York' }],
    listings: [{ id: MY_STORE, owner_id: OWNER, business_name: 'My Store', license_type: 'dispensary', license_number: 'LIC-A', city: 'Albany', state: 'New York', contact_name: 'Sam', contact_email: 'o@s.com', sells: [], buys: [], image_url: null, created_at: '2026-01-01T00:00:00Z' }],
    conversations: [], messages: [], saved_partners: []
  };
  window.__db = db;
  window.__ids = { OWNER, MY_STORE };
  let session = { user: { id: OWNER, email: 'o@s.com' } };
  const ilikeRe = (p) => new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
  function builder(table) {
    const st = { table, op: 'select', payload: null, eqs: [], neqs: [], ins: [], ilikes: [], ors: [], from: null, to: null };
    function match() {
      let r = db[table] ? db[table].slice() : [];
      st.eqs.forEach(f => { r = r.filter(x => String(x[f.col]) === String(f.val)); });
      st.neqs.forEach(f => { r = r.filter(x => String(x[f.col]) !== String(f.val)); });
      st.ins.forEach(f => { r = r.filter(x => f.arr.map(String).includes(String(x[f.col]))); });
      st.ilikes.forEach(f => { const re = ilikeRe(f.pat); r = r.filter(x => re.test(String(x[f.col] == null ? '' : x[f.col]))); });
      st.ors.forEach(g => { r = r.filter(x => g.some(c => ilikeRe(c.pat).test(String(x[c.col] == null ? '' : x[c.col])))); });
      return r;
    }
    function exec() {
      if (st.op === 'select') { let r = match(); if (st.from != null) r = r.slice(st.from, (st.to != null ? st.to : r.length - 1) + 1); return { data: r, error: null }; }
      if (st.op === 'insert') { const arr = Array.isArray(st.payload) ? st.payload : [st.payload]; const ins = arr.map(p => { const row = { ...p }; if (row.id == null) row.id = uuid('ffff'); if (row.created_at == null) row.created_at = new Date().toISOString(); db[table].push(row); return row; }); return { data: ins, error: null }; }
      if (st.op === 'update') { const targets = match(); targets.forEach(row => Object.assign(row, st.payload)); return { data: targets, error: null }; }
      if (st.op === 'upsert') { const arr = Array.isArray(st.payload) ? st.payload : [st.payload]; arr.forEach(p => { const ex = db[table].find(x => String(x.id) === String(p.id)); if (ex) Object.assign(ex, p); else db[table].push({ ...p }); }); return { data: arr, error: null }; }
      return { data: [], error: null };
    }
    const api = {
      select() { return api; }, insert(p) { st.op = 'insert'; st.payload = p; return api; }, update(p) { st.op = 'update'; st.payload = p; return api; }, upsert(p) { st.op = 'upsert'; st.payload = p; return api; },
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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route('**/*', r => r.request().url().startsWith('file://') ? r.continue() : r.abort());
  await page.addInitScript(initScript);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.evaluate(async () => { window.eval('authRestoreInFlight=null'); await restoreSessionFromSupabase({ preserveView: true }); });
  await page.waitForTimeout(400);

  const results = [];
  const rec = (n, p, d) => results.push({ n, p, d: d || '' });

  // Open the main-business editor.
  await page.evaluate(() => openBusinessEditModal(window.__ids.MY_STORE));
  await page.waitForTimeout(200);
  rec('Edit Business modal opens', await page.evaluate(() => document.getElementById('accountModal').classList.contains('open')));
  rec('Selling products field exists in Edit Business', await page.evaluate(() => !!document.getElementById('accountSells')));
  rec('Buying products field exists in Edit Business', await page.evaluate(() => !!document.getElementById('accountBuys')));

  // Fill products and save.
  await page.evaluate(async () => {
    document.getElementById('accountSells').value = 'Frosted Oranges 1/2 Oz\nBlue Dream Eighths';
    document.getElementById('accountBuys').value = 'Bulk Flower 10 Pound Lots';
    await saveBusinessInfo();
  });
  await page.waitForTimeout(400);

  const saved = await page.evaluate(() => {
    const row = window.__db.listings.find(l => String(l.id) === String(window.__ids.MY_STORE));
    return { sells: row.sells, buys: row.buys };
  });
  rec('Selling products persisted to listing', Array.isArray(saved.sells) && saved.sells.length === 2 && saved.sells[0] === 'Frosted Oranges 1/2 Oz', JSON.stringify(saved.sells));
  rec('Buying products persisted to listing', Array.isArray(saved.buys) && saved.buys.length === 1 && saved.buys[0] === 'Bulk Flower 10 Pound Lots', JSON.stringify(saved.buys));

  // Reopen and confirm the saved products are pre-filled.
  await page.evaluate(() => openBusinessEditModal(window.__ids.MY_STORE));
  await page.waitForTimeout(200);
  const reopened = await page.evaluate(() => ({ sells: document.getElementById('accountSells').value, buys: document.getElementById('accountBuys').value }));
  rec('Saved products re-populate on reopen', /Frosted Oranges/.test(reopened.sells) && /Bulk Flower/.test(reopened.buys), JSON.stringify(reopened));

  rec('No page errors', errs.length === 0, errs.join(' | '));

  console.log('\n===== EDIT BUSINESS PRODUCTS TEST =====');
  let pass = 0;
  for (const r of results) { console.log(`${r.p ? 'PASS' : 'FAIL'}  ${r.n}${r.p ? '' : '  →  ' + r.d}`); if (r.p) pass++; }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})();
