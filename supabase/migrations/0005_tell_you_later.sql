-- Couples App — "Tell you later" (migration 0005)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql, 0002_cravings.sql, 0003_profiles.sql, and
-- 0004_dinner_dates.sql already ran (see README.md). Do not run it in
-- the Bark Park Buddies project. Do not re-run 0001, 0002, 0003, or
-- 0004; this file only adds the tell_you_later table.

-- ---------------------------------------------------------------------------
-- Table
--
-- A "tell you later" note is something one of you wants to say to the
-- other but not right now: "remind me to tell you something", "remind
-- me to do something", or good news worth celebrating later instead of
-- forgetting it by dinner. Three kinds:
--   tell — something to tell the other ("I need to tell you about…")
--   do   — something to remember to do ("Remind me to…")
--   news — good news to celebrate together later
-- Done notes stay in the table so the app can show them in history.
-- ---------------------------------------------------------------------------

create table if not exists tell_you_later (
  id uuid primary key default gen_random_uuid(),
  kind text not null
    check (kind in ('tell', 'do', 'news')),
  text text not null,
  note text not null default '',
  wanted_by text not null
    check (wanted_by in ('Andrew', 'Juliette')),
  is_done boolean not null default false,
  done_by text
    check (done_by in ('Andrew', 'Juliette')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Same deliberate sharing model as the other tables: any signed-in user
-- can read and write every row, and nobody signed out can read or write
-- anything. See 0001_couples_app.sql for the reasoning.
-- ---------------------------------------------------------------------------

alter table tell_you_later enable row level security;

drop policy if exists "Authenticated users can read and write" on tell_you_later;
create policy "Authenticated users can read and write"
  on tell_you_later for all
  to authenticated
  using (true)
  with check (true);
