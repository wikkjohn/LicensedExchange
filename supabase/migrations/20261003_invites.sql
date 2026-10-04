-- Invite codes gate for soft launch.
-- Each row is a single-use code. The client checks `used_at IS NULL` before
-- allowing sign-up to proceed, then sets `used_at` on successful account creation.

create table if not exists invites (
  id            text primary key default gen_random_uuid()::text,
  code          text not null unique,
  created_at    timestamptz not null default now(),
  used_at       timestamptz,
  used_by_email text,
  note          text          -- optional label, e.g. "sent to Kenzie 2026-10-03"
);

-- Anyone (anon) can read and update invite rows so the client-side flow works
-- without a service-role key.
alter table invites enable row level security;

create policy "anyone can check invites"
  on invites for select using (true);

create policy "anyone can claim an invite"
  on invites for update using (used_at is null);

-- Seed a few starter codes. Replace or add via the Supabase dashboard.
insert into invites (code, note) values
  ('HARVEST-2026',  'general soft-launch batch'),
  ('CULTIVATE-001', 'cultivator cohort'),
  ('DISPENSE-001',  'dispensary cohort'),
  ('FOUNDER-ALPHA', 'early access')
on conflict (code) do nothing;
