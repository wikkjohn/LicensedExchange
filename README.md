
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

## ✅ Running the tests

The `tests/` folder has automated browser tests that drive the real app
(signup, login, posting a listing, messaging, saving partners, search,
filtering, and pagination) against an in-memory fake of Supabase — so they
never touch the live database.

**First time only**, download the browser the tests use:

```bash
npm install
npm run test:setup
```

Then, any time you want to check that everything still works:

```bash
npm test
```

You'll see a list of checks ending in either `✅ All 3 test suites passed.`
or a red `❌` with the failing check. Run this after making changes and
before deploying — if it's green, the core user flows still work.

What each suite covers:

| File | What it checks |
|------|----------------|
| `tests/e2e_full.js` | The whole journey: sign up → log in → post a listing → message a partner → save a partner → log out. |
| `tests/test_pagination.js` | Browse loads listings 24 at a time, and "Load more" fetches the next page. |
| `tests/test_server_search.js` | Search and the category filter run inside the database query and return the right results. |

## 🧠 Supabase setup

1. Create a Supabase project.
2. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `index.html`.
3. Create the required tables & policies.

### Database schema

The app talks to these five tables (all with Row Level Security enabled and
owner-scoped policies). This matches the live project — use it as the source
of truth when recreating the database in a new Supabase project.

```sql
-- profiles: one row per auth user (id references auth.users.id)
create table profiles (
  id uuid primary key references auth.users(id),
  email text,
  contact_email text,
  contact_name text,
  business_name text,
  license_number text,
  license_type text,
  city text,
  state text default 'New York',
  business_address text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- listings: businesses and the products they buy/sell
create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  business_name text not null,
  license_type text,
  license_number text,
  city text,
  state text default 'New York',
  contact_name text,
  contact_email text,
  sells text[],
  buys text[],
  is_default_listing boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- conversations: a thread between two listings
create table conversations (
  id uuid primary key default gen_random_uuid(),
  listing_a_id uuid references listings(id),
  listing_b_id uuid references listings(id),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- messages: individual chat messages within a conversation
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id),
  sender_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz default now()
);

-- saved_partners: listings a user has bookmarked
create table saved_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  listing_id uuid references listings(id),
  created_at timestamptz default now()
);

alter table profiles       enable row level security;
alter table listings       enable row level security;
alter table conversations  enable row level security;
alter table messages       enable row level security;
alter table saved_partners enable row level security;
```

> RLS policies (owner-scoped reads/writes, public read of listings for
> browse) are already configured on the live project. Recreate them to match
> when standing up a fresh database.

### (Optional) Supabase CLI commands

If you have the Supabase CLI installed, you can:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db reset --yes
```

4. (Optional) License verification.

   The app currently verifies licenses by querying the NYS OCM open-data API
   (`data.ny.gov`) **directly from the browser** in `verifyLicense()` — no
   backend is required for it to work today.

   A `supabase/functions/verify-license` Edge Function is included as an
   optional server-side alternative (e.g. to hide the upstream call or add
   caching). It is **not deployed or wired into the frontend** by default. To
   use it, deploy it and point the frontend at its URL:

   ```bash
   supabase functions deploy verify-license
   ```

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

