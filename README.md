
# Licensed Business Exchange

A static directory UI with Supabase auth, listings CRUD, chat, and license verification.

## 🚀 Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm start
```

Then open: http://localhost:3000

## 🧠 Supabase setup

1. Create a Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `index.html`.
3. Create the required tables & policies.

### SQL to run in Supabase SQL editor

```sql
-- Listings table
create table listings (
  id text primary key,
  owner_id text not null,
  name text,
  licenseid text,
  status text,
  location text,
  categories text[],
  buys text[],
  sells text[],
  contact jsonb,
  notes text,
  updatedat timestamptz default now()
);

alter table listings enable row level security;

create policy "Listings: select" on listings
  for select using (
    auth.role() = 'authenticated' and (
      owner_id = auth.uid() or owner_id = 'public'
    )
  );

create policy "Listings: insert" on listings
  for insert with check (
    auth.role() = 'authenticated' and owner_id = auth.uid()
  );

create policy "Listings: update" on listings
  for update using (
    auth.role() = 'authenticated' and owner_id = auth.uid()
  );

create policy "Listings: delete" on listings
  for delete using (
    auth.role() = 'authenticated' and owner_id = auth.uid()
  );

-- Messages table
create table messages (
  id text primary key,
  sender text not null,
  receiver text not null,
  text text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;

create policy "Messages: select" on messages
  for select using (
    auth.role() = 'authenticated' and (
      sender = auth.email() or receiver = auth.email()
    )
  );

create policy "Messages: insert" on messages
  for insert with check (
    auth.role() = 'authenticated' and sender = auth.email()
  );

-- Presence table
create table presence (
  email text primary key,
  last_seen timestamptz not null default now()
);

alter table presence enable row level security;

create policy "Presence: select" on presence
  for select using (
    auth.role() = 'authenticated' and email = auth.email()
  );

create policy "Presence: upsert" on presence
  for insert with check (
    auth.role() = 'authenticated' and email = auth.email()
  ) using (
    auth.role() = 'authenticated' and email = auth.email()
  );
```

### (Optional) Supabase CLI commands

If you have the Supabase CLI installed, you can:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db reset --yes
```

4. Deploy the Edge Function (license verification):

```bash
supabase functions deploy verify-license
```

5. Update `index.html`:

```js
const OCM_LICENSE_API = "https://<project>.functions.supabase.co/verify-license";
```

## 🧩 Deploy

For a static frontend, you can deploy this folder to any static host:
- GitHub Pages
- Netlify
- Vercel

For the backend / license API, use Supabase Functions (as shown above).

## 📢 Ad Integration

This project includes Google Ad Manager (GAM) integration for displaying ads.

### Setup

1. **Configure your ad network**: Update `ads.js` with your Google Ad Manager network code and ad unit paths.

2. **Replace placeholders**: In `ads.js`, change:
   - `YOUR_NETWORK_CODE` to your actual GAM network code
   - `/YOUR_NETWORK_CODE/...` paths to your ad unit paths

3. **Ad slots included**:
   - Header leaderboard (728x90, responsive to 320x50)
   - Hero banner (970x90, responsive to 728x90)
   - Sidebar ads (3x 300x250)

### Files

- `ads.js`: Main ad configuration and initialization
- `docs/ad-reference/ads_bundle.html`: Reference implementation (DO NOT use in production)
- `docs/ad-reference/AdsNote.txt`: Important notes about ad setup

### Important Notes

- Ads will only display if you have live creatives in GAM targeting the configured ad units
- The site must be served over HTTPS for ads to load
- Test thoroughly before going live

