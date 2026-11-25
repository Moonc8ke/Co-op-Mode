-- ===========================================================================
-- Co-op Mode migration 0011_grocery_list — shared grocery list
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- migration 0010_unique_space_names.sql. Run it in the SAME Supabase
-- project where 0001-0010 already ran. Do not run it in the Bark Park
-- Buddies project.
--
-- What it does:
--   * creates table `grocery_items`: one row per thing to pick up.
--     title is the item, note is the quantity or detail (e.g. "2 lbs",
--     "the good kind"), wanted_by is who added it (free-form name,
--     migration 0009 — no Andrew/Juliette check here), is_done /
--     done_by / done_at track who picked it up and when. Done items
--     stay in the table so the app can show them in "Picked up"
--     history; unchecking brings an item back.
--   * space_id is on the table from the start, with the same
--     space-scoped RLS as cravings and tell-you-later (migration
--     0007): each space sees only its own rows.
-- ===========================================================================

create table if not exists grocery_items (
  id bigint generated always as identity primary key,
  title text not null,
  note text not null default '',
  wanted_by text not null,
  is_done boolean not null default false,
  done_by text,
  done_at timestamptz,
  space_id uuid references spaces (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: each space sees only its own rows.
-- A user with no space (my_space_id() IS NULL) sees nothing.
-- ---------------------------------------------------------------------------

alter table grocery_items enable row level security;

drop policy if exists "Space members can read and write" on grocery_items;
create policy "Space members can read and write"
  on grocery_items for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());
