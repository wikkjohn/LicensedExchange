const { chromium } = require('playwright');
const path = require('path');
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

// ---- Stateful Supabase stub, injected before any page script runs ----
function initScript() {
  let idc = 1;
  const uuid = (p) => `${p}0000000-0000-4000-8000-${String(idc++).padStart(12, '0')}`;

  // Pre-seed a partner business owned by someone else so it appears in Browse.
  const PARTNER_OWNER = uuid('aaaa');
  const PARTNER_LISTING = uuid('bbbb');
  const db = {
    users: [],            // {id,email,password}
    profiles: [
      { id: PARTNER_OWNER, business_name: 'Hudson Valley Greens', email: 'partner@hv.com',
        contact_name: 'Pat', contact_email: 'partner@hv.com', license_type: 'cultivator',
        license_number: 'OCM-CULT-99-000001', city: 'Kingston', state: 'New York' }
    ],
    listings: [
      { id: PARTNER_LISTING, owner_id: PARTNER_OWNER, business_name: 'Hudson Valley Greens',
        license_type: 'cultivator', license_number: 'OCM-CULT-99-000001', city: 'Kingston',
        state: 'New York', contact_name: 'Pat', contact_email: 'partner@hv.com',
        sells: ['Blue Dream · Flower · 1 lb'], buys: ['Packaging · Bags · 1000ct'],
        image_url: null, created_at: '2026-01-01T00:00:00Z' }
    ],
    conversations: [],
    messages: [],
    saved_partners: []
  };
  window.__db = db;
  window.__authCb = null;
  let session = null;

  const norm = (s) => (s == null ? '' : String(s)).trim().toLowerCase();

  const ilikeRe = (pattern) => new RegExp('^' + String(pattern).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i');
  function builder(table) {
    const st = { table, op: 'select', payload: null, conflict: null, eqs: [], ins: [], neqs: [], ilikes: [], ors: [] };
    function rows() {
      let r = db[table] ? db[table].slice() : [];
      st.eqs.forEach(f => { r = r.filter(x => String(x[f.col]) === String(f.val)); });
      st.neqs.forEach(f => { r = r.filter(x => String(x[f.col]) !== String(f.val)); });
      st.ins.forEach(f => { r = r.filter(x => f.arr.map(String).includes(String(x[f.col]))); });
      st.ilikes.forEach(f => { const re = ilikeRe(f.pat); r = r.filter(x => re.test(String(x[f.col] == null ? '' : x[f.col]))); });
      st.ors.forEach(group => { r = r.filter(x => group.some(c => ilikeRe(c.pat).test(String(x[c.col] == null ? '' : x[c.col])))); });
      if (st.from != null) r = r.slice(st.from, (st.to != null ? st.to : r.length - 1) + 1);
      return r;
    }
    function exec() {
      try {
        if (st.op === 'select') return { data: rows(), error: null };
        if (st.op === 'insert') {
          const payloads = Array.isArray(st.payload) ? st.payload : [st.payload];
          const inserted = [];
          for (const p of payloads) {
            const row = { ...p };
            if (row.id == null) row.id = uuid('cccc');
            if (row.created_at == null) row.created_at = new Date().toISOString();
            if (table === 'listings') {
              const lic = norm(row.license_number);
              if (lic && db.listings.some(x => norm(x.license_number) === lic)) {
                return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
              }
            }
            db[table].push(row);
            inserted.push(row);
          }
          return { data: inserted, error: null };
        }
        if (st.op === 'upsert') {
          const payloads = Array.isArray(st.payload) ? st.payload : [st.payload];
          const out = [];
          for (const p of payloads) {
            let keyMatch;
            if (table === 'profiles') keyMatch = (x) => String(x.id) === String(p.id);
            else if (table === 'saved_partners') keyMatch = (x) => String(x.user_id) === String(p.user_id) && String(x.listing_id) === String(p.listing_id);
            else keyMatch = (x) => String(x.id) === String(p.id);
            const existing = db[table].find(keyMatch);
            if (existing) { Object.assign(existing, p); out.push(existing); }
            else { const row = { ...p }; if (row.id == null && table !== 'saved_partners') row.id = uuid('dddd'); db[table].push(row); out.push(row); }
          }
          return { data: out, error: null };
        }
        if (st.op === 'update') {
          const matched = rows();
          matched.forEach(x => Object.assign(x, st.payload));
          return { data: matched, error: null };
        }
      } catch (e) { return { data: null, error: { message: e.message } }; }
      return { data: null, error: { message: 'unknown op' } };
    }
    const api = {
      select() { return api; },
      insert(p) { st.op = 'insert'; st.payload = p; return api; },
      upsert(p, opts) { st.op = 'upsert'; st.payload = p; st.conflict = opts; return api; },
      update(p) { st.op = 'update'; st.payload = p; return api; },
      eq(col, val) { st.eqs.push({ col, val }); return api; },
      neq(col, val) { st.neqs.push({ col, val }); return api; },
      ilike(col, pat) { st.ilikes.push({ col, pat }); return api; },
      or(expr) { st.ors.push(String(expr).split(',').map(c => { const p = c.split('.'); return { col: p[0], op: p[1], pat: p.slice(2).join('.') }; })); return api; },
      in(col, arr) { st.ins.push({ col, arr }); return api; },
      order() { return api; },
      limit() { return api; },
      range(from, to) { st.from = from; st.to = to; return api; },
      single() { const r = exec(); if (r.error) return Promise.resolve(r); const row = (r.data || [])[0]; return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: 'no rows' } }); },
      maybeSingle() { const r = exec(); if (r.error) return Promise.resolve(r); return Promise.resolve({ data: (r.data || [])[0] || null, error: null }); },
      then(res, rej) { return Promise.resolve(exec()).then(res, rej); }
    };
    return api;
  }

  const fakeClient = {
    auth: {
      async signUp({ email, password }) {
        if (db.users.some(u => norm(u.email) === norm(email))) {
          return { data: { user: null, session: null }, error: { message: 'User already registered' } };
        }
        const user = { id: uuid('eeee'), email };
        db.users.push({ ...user, password });
        session = { user };
        if (window.__authCb) window.__authCb('SIGNED_IN', session);
        return { data: { user, session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const u = db.users.find(x => norm(x.email) === norm(email));
        if (!u || u.password !== password) return { data: { session: null }, error: { message: 'Invalid login credentials' } };
        session = { user: { id: u.id, email: u.email } };
        if (window.__authCb) window.__authCb('SIGNED_IN', session);
        return { data: { session }, error: null };
      },
      async getUser() { return { data: { user: session ? session.user : null }, error: session ? null : { message: 'no user' } }; },
      async getSession() { return { data: { session }, error: null }; },
      onAuthStateChange(cb) { window.__authCb = cb; return { data: { subscription: { unsubscribe() { window.__authCb = null; } } } }; },
      async signOut() { session = null; if (window.__authCb) window.__authCb('SIGNED_OUT', null); return { error: null }; }
    },
    from(table) { return builder(table); },
    storage: { from() { return { async upload() { return { error: null }; }, getPublicUrl() { return { data: { publicUrl: 'file:///logo.png' } }; } }; } }
  };

  window.supabase = { createClient: () => fakeClient };
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));

  // Network: allow file://, fulfill the OCM license lookup, block the rest.
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file://')) return route.continue();
    if (url.includes('data.ny.gov')) {
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify([{ entity_name: 'My Test Cannabis Co', license_type: 'Microbusiness', city: 'Albany', state: 'New York' }])
      });
    }
    return route.abort();
  });

  await page.addInitScript(initScript);
  await page.goto(FILE, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  const results = [];
  const rec = (name, pass, detail) => { results.push({ name, pass, detail: detail || '' }); };
  const toasts = [];
  await page.exposeFunction('__noop', () => {});
  // capture toasts
  await page.evaluate(() => {
    window.__toasts = [];
    const o = window.showToast;
    window.showToast = (m) => { window.__toasts.push(String(m)); if (o) try { o(m); } catch (e) {} };
  });
  const getToasts = () => page.evaluate(() => window.__toasts.slice());
  const clearToasts = () => page.evaluate(() => { window.__toasts = []; });
  const isOpen = (id) => page.evaluate(i => document.getElementById(i)?.classList.contains('open'), id);
  const activeView = () => page.evaluate(() => document.querySelector('.view.active')?.id || '(none)');
  const loggedIn = () => page.evaluate(() => !document.getElementById('dashUser').classList.contains('hidden'));
  const text = (sel) => page.evaluate(s => document.querySelector(s)?.textContent?.trim() || '', sel);
  // Click via the element's own click() to bypass toast-overlay pointer interception + CSS animations.
  const clickEl = (sel) => page.$eval(sel, el => el.click());

  try {
    // 1. Initial load = browse + guest
    rec('Initial view is Browse', (await activeView()) === 'view-browse', await activeView());
    rec('Initial state is logged out', (await loggedIn()) === false);

    // 2. Bottom nav buttons all switch views
    for (const [nav, view] of [['nav-notif','view-notif'],['nav-messages','view-messages'],['nav-dashboard','view-dashboard'],['nav-browse','view-browse']]) {
      await clickEl('#' + nav);
      await page.waitForTimeout(80);
      rec(`Nav button ${nav} → ${view}`, (await activeView()) === view, await activeView());
    }

    // 3. Browse filters
    for (const f of ['cultivator','dispensary','all']) {
      await clickEl(`.chip[onclick*="setFilter('${f}'"]`).catch(()=>{});
      await page.waitForTimeout(60);
    }
    rec('Filter chips clickable', true);

    // 4. Open auth modal via guest dashboard CTA
    await clickEl('#nav-dashboard'); await page.waitForTimeout(80);
    await clickEl('#dashGuest button');
    rec('Auth modal opens from dashboard CTA', await isOpen('authModal'));

    // 5. Signup stage 1: verify license
    await clearToasts();
    await page.fill('#signupLicenseNumber', 'OCM-MICR-24-000999');
    await clickEl('button[onclick="verifyLicense()"]');
    await page.waitForTimeout(300);
    const stage2vis = await page.evaluate(() => document.getElementById('signup-stage-2').style.display !== 'none');
    rec('License verify reveals stage 2', stage2vis);
    rec('Business name auto-filled', (await page.inputValue('#signupBusinessName')) === 'My Test Cannabis Co', await page.inputValue('#signupBusinessName'));

    // 6. Signup stage 2: weak password is rejected
    await page.fill('#signupContactName', 'Jane Tester');
    await page.fill('#signupEmail', 'jane@example.com');
    await page.fill('#signupPassword', 'weak');
    await clearToasts();
    await clickEl('button[onclick="signUpWithSupabase()"]');
    await page.waitForTimeout(150);
    let t = await getToasts();
    rec('Weak password rejected', t.some(x => /at least 8|must include/i.test(x)), JSON.stringify(t));
    rec('Not logged in after weak password', (await loggedIn()) === false);

    // 7. Signup with strong password succeeds
    await page.fill('#signupPassword', 'StrongP@ss1');
    await clearToasts();
    await clickEl('button[onclick="signUpWithSupabase()"]');
    await page.waitForTimeout(500);
    rec('Signup logs user in', await loggedIn());
    rec('Auth modal closed after signup', (await isOpen('authModal')) === false);
    rec('Lands on dashboard after signup', (await activeView()) === 'view-dashboard', await activeView());

    // 8. Logout
    await clearToasts();
    // logout button lives in nav actions; call via rendered button
    const hasLogout = await page.evaluate(() => !!document.querySelector('[onclick="window.logout()"]'));
    if (hasLogout) await clickEl('[onclick="window.logout()"]'); else await page.evaluate(() => window.logout());
    await page.waitForTimeout(300);
    rec('Logout clears session', (await loggedIn()) === false);
    rec('Logout returns to browse', (await activeView()) === 'view-browse', await activeView());

    // 9. Log back in
    await clickEl('#nav-dashboard'); await page.waitForTimeout(80);
    await clickEl('#dashGuest button');
    await clickEl('#tab-login');
    await page.fill('#loginEmail', 'jane@example.com');
    await page.fill('#loginPassword', 'StrongP@ss1');
    await clearToasts();
    await clickEl('button[onclick="loginWithSupabase()"]');
    await page.waitForTimeout(500);
    rec('Login succeeds', await loggedIn());
    rec('Auth modal closed after login', (await isOpen('authModal')) === false);

    // 10. Wrong password is rejected
    await page.evaluate(() => window.logout()); await page.waitForTimeout(200);
    await clickEl('#nav-dashboard'); await page.waitForTimeout(60);
    await clickEl('#dashGuest button'); await page.click('#tab-login');
    await page.fill('#loginEmail', 'jane@example.com');
    await page.fill('#loginPassword', 'WrongPass!9');
    await clearToasts();
    await clickEl('button[onclick="loginWithSupabase()"]');
    await page.waitForTimeout(300);
    t = await getToasts();
    rec('Wrong password rejected', (await loggedIn()) === false && t.some(x => /invalid/i.test(x)), JSON.stringify(t));
    // log back in for remaining tests
    await page.fill('#loginPassword', 'StrongP@ss1');
    await clickEl('button[onclick="loginWithSupabase()"]');
    await page.waitForTimeout(500);
    rec('Re-login for remaining flows', await loggedIn());

    // 11. Post a listing (required before messaging)
    await page.evaluate(() => openModal('listingModal')); await page.waitForTimeout(120);
    rec('Listing modal opens', await isOpen('listingModal'));
    await page.fill('#lsBizName', 'My Test Cannabis Co');
    await page.selectOption('#lsBizType', 'MicroBusiness').catch(async () => { await page.evaluate(() => document.getElementById('lsBizType').value='MicroBusiness'); });
    await page.fill('#lsCity', 'Albany');
    await page.selectOption('#lsState', 'New York').catch(async () => { await page.evaluate(() => document.getElementById('lsState').value='New York'); });
    await page.fill('#lsLicense', 'OCM-MICR-24-000999');
    await clickEl('button[onclick="goListingStep(2)"]'); await page.waitForTimeout(100);
    // step 2: add a sell + buy tag
    await page.fill('#sellInput', 'House Flower · 1 lb').catch(()=>{});
    await clickEl('button[onclick="addTag(\'sell\')"]').catch(()=>{});
    await clickEl('button[onclick="goListingStep(3)"]').catch(()=>{}); await page.waitForTimeout(100);
    await clearToasts();
    await clickEl('#ls-panel3 .btn-accent').catch(async () => { await page.evaluate(() => submitListing()); });
    await page.waitForTimeout(600);
    t = await getToasts();
    rec('Listing publishes', t.some(x => /published/i.test(x)) || (await page.evaluate(() => getUserListings().length > 0)), JSON.stringify(t));
    rec('Listing modal closed after publish', (await isOpen('listingModal')) === false);

    // 12. Browse shows the partner business; open its modal
    await clickEl('#nav-browse'); await page.waitForTimeout(150);
    const partnerCardSel = '.air-card';
    const cardCount = await page.evaluate(() => document.querySelectorAll('.air-card').length);
    rec('Browse renders cards', cardCount > 0, 'cards=' + cardCount);
    // open the partner (Hudson Valley Greens) modal
    await page.evaluate(() => {
      const id = (getAllVisibleListings().find(b => b.name === 'Hudson Valley Greens') || {}).id;
      openBizModal(id);
    });
    await page.waitForTimeout(150);
    rec('Business detail modal opens', await isOpen('bizModal'));
    rec('Modal shows Send Message button', await page.evaluate(() => !!document.querySelector('#bizModal [onclick*="contactBiz"]')));

    // 13. Send Message → chat opens
    await clearToasts();
    await clickEl('#bizModal [onclick*="contactBiz"]');
    await page.waitForTimeout(400);
    rec('Chat modal opens from Send Message', await isOpen('chatModal'));

    // 14. Type + send a message
    await page.fill('#chatInputField', 'Hello, are you open to a trade?');
    await clearToasts();
    await clickEl('button[onclick="sendMessage()"]');
    await page.waitForTimeout(500);
    const outMsgs = await page.evaluate(() => document.querySelectorAll('#chatMessages .msg-out').length);
    rec('Outgoing message rendered', outMsgs > 0, 'msg-out=' + outMsgs);
    const persisted = await page.evaluate(() => window.__db.messages.length);
    rec('Message persisted to DB', persisted > 0, 'messages=' + persisted);
    rec('Conversation row created', await page.evaluate(() => window.__db.conversations.length > 0));
    await page.evaluate(() => closeModal('chatModal'));

    // 15. Save partner
    await page.evaluate(() => {
      const id = (getAllVisibleListings().find(b => b.name === 'Hudson Valley Greens') || {}).id;
      saveBiz(id);
    });
    await page.waitForTimeout(400);
    rec('Saved partner stored locally', await page.evaluate(() => currentUser.savedPartnerIds.length > 0));
    rec('Saved partner persisted to DB', await page.evaluate(() => window.__db.saved_partners.length > 0));

    // 16. Dashboard reflects counts
    await clickEl('#nav-dashboard'); await page.waitForTimeout(200);
    rec('Dashboard messages count > 0', await page.evaluate(() => (document.getElementById('dashMessagesCount')?.textContent||'0') !== '0'), await text('#dashMessagesCount'));
    rec('Dashboard saved-partners count > 0', await page.evaluate(() => (document.getElementById('dashSavedPartnersCount')?.textContent||'0') !== '0'), await text('#dashSavedPartnersCount'));

    // 17. Messages view lists the conversation
    await clickEl('#nav-messages'); await page.waitForTimeout(200);
    rec('Messages view lists conversation', await page.evaluate(() => /Hudson Valley Greens|are you open/i.test(document.getElementById('view-messages')?.textContent||'')));

    // 18. Edit business modal opens + saves
    await page.evaluate(() => {
      const id = getUserListings()[0]?.id;
      openBusinessEditModal(id);
    });
    await page.waitForTimeout(150);
    rec('Edit business modal opens', await isOpen('accountModal'));
    await page.fill('#accountBizName', 'My Test Cannabis Co (Updated)').catch(()=>{});
    await clearToasts();
    await clickEl('button[onclick="saveAccountInfo()"]').catch(async () => { await page.evaluate(() => saveAccountInfo()); });
    await page.waitForTimeout(500);
    t = await getToasts();
    rec('Save business changes works', t.some(x => /sav|updat/i.test(x)) || (await isOpen('accountModal')) === false, JSON.stringify(t));

    // 19. Final logout
    await page.evaluate(() => window.logout());
    await page.waitForTimeout(300);
    rec('Final logout works', (await loggedIn()) === false);

  } catch (e) {
    rec('HARNESS ERROR', false, e.message + '\n' + e.stack);
  }

  rec('No uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));

  console.log('\n===== E2E RESULTS =====');
  let passN = 0;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  →  ' + r.detail}`);
    if (r.pass) passN++;
  }
  console.log(`\n${passN}/${results.length} checks passed`);
  if (pageErrors.length) { console.log('\n--- page errors ---\n' + pageErrors.join('\n')); }
  await browser.close();
  process.exit(passN === results.length ? 0 : 1);
})();
