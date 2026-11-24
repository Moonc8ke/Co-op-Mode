-- ===========================================================================
-- Co-op Mode migration 0007_spaces — Phase 1a: walled-off spaces
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- taking the app's built-in JSON export as a backup. Run it in the SAME
-- Supabase project where 0001-0006 already ran. Do not run it in the
-- Bark Park Buddies project. Do not re-run 0001-0006.
--
-- What it does, matching households-build-plan.md (Phase 1a):
--   * creates table `spaces` ("Relationship Space" in the UI, "space"
--     in code), one row for Andrew & Juliette;
--   * adds `space_id` to items, events, dinner_proposals, memories,
--     cravings, tell_you_later, and profiles, and backfills every
--     existing row to the Andrew & Juliette space (nothing is deleted);
--   * adds helper `public.my_space_id()` and rewrites the RLS policies
--     on those seven tables from "Authenticated users can read and
--     write" to "Space members can read and write".
--   * does NOT touch push_subscriptions (already per-user) or the
--     scrapbook-photos storage bucket (public until Phase 1b).
--
-- The app change that goes with this migration is in src/lib/data.ts:
-- every list filters by the signed-in user's space_id and every
-- insert tags the new row with it (getMySpaceId). A brand-new account
-- with no profile row has my_space_id() = NULL and sees an empty app
-- until Andrew assigns it a space in SQL — that is the intended
-- isolation proof, and the invite flow that fixes it properly is
-- Phase 2.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Spaces table
-- ---------------------------------------------------------------------------

create table if not exists spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null
    default substr(md5(random()::text), 1, 12),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- space_id on every shared table
-- ---------------------------------------------------------------------------

alter table items
  add column if not exists space_id uuid references spaces (id);
alter table events
  add column if not exists space_id uuid references spaces (id);
alter table dinner_proposals
  add column if not exists space_id uuid references spaces (id);
alter table memories
  add column if not exists space_id uuid references spaces (id);
alter table cravings
  add column if not exists space_id uuid references spaces (id);
alter table tell_you_later
  add column if not exists space_id uuid references spaces (id);
alter table profiles
  add column if not exists space_id uuid references spaces (id);

-- ---------------------------------------------------------------------------
-- Backfill: one space for Andrew & Juliette, every existing row tagged.
-- Re-runnable: if a space already exists it reuses it instead of
-- creating a second one. Only rows with space_id NULL are touched.
-- ---------------------------------------------------------------------------

do $$
declare
  v_space_id uuid;
begin
  select id into v_space_id from spaces order by created_at limit 1;
  if v_space_id is null then
    insert into spaces (name) values ('Andrew & Juliette')
      returning id into v_space_id;
  end if;

  update profiles       set space_id = v_space_id where space_id is null;
  update items          set space_id = v_space_id where space_id is null;
  update events         set space_id = v_space_id where space_id is null;
  update dinner_proposals set space_id = v_space_id where space_id is null;
  update memories       set space_id = v_space_id where space_id is null;
  update cravings       set space_id = v_space_id where space_id is null;
  update tell_you_later set space_id = v_space_id where space_id is null;
end $$;

-- ---------------------------------------------------------------------------
-- Helper: the signed-in user's space, read from their profiles row.
-- SECURITY DEFINER so it works even though the caller cannot yet read
-- profiles under the new policies. Same pattern as the Bark Park
-- Buddies RPCs.
-- ---------------------------------------------------------------------------

create or replace function public.my_space_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select space_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security: each space sees only its own rows.
-- A user with no space (my_space_id() IS NULL) sees nothing.
-- ---------------------------------------------------------------------------

alter table spaces enable row level security;

drop policy if exists "Space members can read their own space" on spaces;
create policy "Space members can read their own space"
  on spaces for select
  to authenticated
  using (id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on items;
create policy "Space members can read and write"
  on items for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on events;
create policy "Space members can read and write"
  on events for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on dinner_proposals;
create policy "Space members can read and write"
  on dinner_proposals for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on memories;
create policy "Space members can read and write"
  on memories for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on cravings;
create policy "Space members can read and write"
  on cravings for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on tell_you_later;
create policy "Space members can read and write"
  on tell_you_later for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

drop policy if exists "Authenticated users can read and write" on profiles;
create policy "Space members can read and write"
  on profiles for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

-- ---------------------------------------------------------------------------
-- REVERT (one paste, only if the testing checklist in the build plan
-- shows something wrong). Restores the old open policies. It does not
-- remove the spaces table or the space_id columns; the JSON backup
-- taken before running is the data rollback.
-- ---------------------------------------------------------------------------
-- drop policy if exists "Space members can read and write" on items;
-- create policy "Authenticated users can read and write"
--   on items for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on events;
-- create policy "Authenticated users can read and write"
--   on events for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on dinner_proposals;
-- create policy "Authenticated users can read and write"
--   on dinner_proposals for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on memories;
-- create policy "Authenticated users can read and write"
--   on memories for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on cravings;
-- create policy "Authenticated users can read and write"
--   on cravings for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on tell_you_later;
-- create policy "Authenticated users can read and write"
--   on tell_you_later for all to authenticated using (true) with check (true);
-- drop policy if exists "Space members can read and write" on profiles;
-- create policy "Authenticated users can read and write"
--   on profiles for all to authenticated using (true) with check (true);
