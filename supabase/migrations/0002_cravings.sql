-- Couples App — cravings board (migration 0002)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql already ran (see README.md). Do not run it in the
-- Bark Park Buddies project. Do not re-run 0001; this file only adds
-- the cravings table.

-- ---------------------------------------------------------------------------
-- Table
--
-- A craving is "I'm craving X" (food, a snack, a treat) or "I'm looking
-- for Y" (an item, a thing they saw somewhere). Either partner can post
-- one; the other can mark it "Got it" when they satisfy it. Fulfilled
-- cravings stay in the table so the app can show them in history.
-- ---------------------------------------------------------------------------

create table if not exists cravings (
  id bigint generated always as identity primary key,
  title text not null,
  kind text not null
    check (kind in ('craving', 'looking_for')),
  note text not null default '',
  wanted_by text not null
    check (wanted_by in ('Andrew', 'Juliette')),
  status text not null default 'open'
    check (status in ('open', 'fulfilled')),
  fulfilled_by text
    check (fulfilled_by in ('Andrew', 'Juliette')),
  fulfilled_note text not null default '',
  created_at timestamptz not null default now(),
  fulfilled_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Same deliberate sharing model as the other tables: any signed-in user
-- can read and write every row, and nobody signed out can read or write
-- anything. See 0001_couples_app.sql for the reasoning.
-- ---------------------------------------------------------------------------

alter table cravings enable row level security;

drop policy if exists "Authenticated users can read and write" on cravings;
create policy "Authenticated users can read and write"
  on cravings for all
  to authenticated
  using (true)
  with check (true);
