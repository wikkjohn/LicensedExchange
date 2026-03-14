
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

