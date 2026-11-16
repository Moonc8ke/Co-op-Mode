-- Couples App — profiles (migration 0003)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql and 0002_cravings.sql already ran (see README.md).
-- Do not run it in the Bark Park Buddies project. Do not re-run 0001 or
-- 0002; this file only adds the profiles table.

-- ---------------------------------------------------------------------------
-- Table
--
-- One row per signed-in account, saying which of the two people it is.
-- The app reads this on sign-in so the dinner and cravings forms already
-- know who is typing, instead of asking "I'm Andrew / I'm Juliette"
-- every time. A person picks their name once, the first time they sign
-- in; the app remembers it on their account, and they can switch it
-- later from the "Posting as …" label on those forms.
--
-- Existing dinner_proposals and cravings rows are untouched — they keep
-- the suggested_by / wanted_by values they were saved with.
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null
    check (display_name in ('Andrew', 'Juliette')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Same deliberate sharing model as the other tables: any signed-in user
-- can read and write every row, and nobody signed out can read or write
-- anything. See 0001_couples_app.sql for the reasoning.
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

drop policy if exists "Authenticated users can read and write" on profiles;
create policy "Authenticated users can read and write"
  on profiles for all
  to authenticated
  using (true)
  with check (true);
