-- ===========================================================================
-- Co-op Mode migration 0012_cooked_ratings — cooked-it ratings
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- migration 0011_grocery_list.sql. Run it in the SAME Supabase project
-- where 0001-0011 already ran. Do not run it in the Bark Park Buddies
-- project.
--
-- What it does:
--   * creates table `cooked_dishes`: one row per dish the space cooked
--     together. title is the dish, cooked_date is when it was made,
--     item_id links back to the recipe idea it came from (null for a
--     standalone dish, and set null if that idea is deleted),
--     cooked_by is who cooked it (free-form name, migration 0009 —
--     no Andrew/Juliette check here; null when unknown).
--   * creates table `dish_ratings`: one rating per person per dish.
--     stars is 1-5, note is an optional thought ("too salty", "make
--     again!"). The unique index on (dish_id, lower(rated_by)) means
--     each person has exactly one rating per dish — rating again
--     overwrites it — and names compare case-insensitively.
--   * space_id is on both tables from the start, with the same
--     space-scoped RLS as cravings and tell-you-later (migration
--     0007): each space sees only its own rows.
-- ===========================================================================

create table if not exists cooked_dishes (
  id bigint generated always as identity primary key,
  title text not null,
  cooked_date date not null,
  item_id bigint references items (id) on delete set null,
  cooked_by text,
  space_id uuid references spaces (id),
  created_at timestamptz not null default now()
);

create table if not exists dish_ratings (
  id bigint generated always as identity primary key,
  dish_id bigint not null references cooked_dishes (id) on delete cascade,
  rated_by text not null,
  stars int not null check (stars between 1 and 5),
  note text not null default '',
  space_id uuid references spaces (id),
  created_at timestamptz not null default now()
);

-- One rating per person per dish (case-insensitive on the name).
create unique index if not exists dish_ratings_dish_person_unique
  on dish_ratings (dish_id, lower(rated_by));

-- ---------------------------------------------------------------------------
-- Row Level Security: each space sees only its own rows.
-- A user with no space (my_space_id() IS NULL) sees nothing.
-- ---------------------------------------------------------------------------

alter table cooked_dishes enable row level security;

drop policy if exists "Space members can read and write" on cooked_dishes;
create policy "Space members can read and write"
  on cooked_dishes for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());

alter table dish_ratings enable row level security;

drop policy if exists "Space members can read and write" on dish_ratings;
create policy "Space members can read and write"
  on dish_ratings for all
  to authenticated
  using (space_id = public.my_space_id())
  with check (space_id = public.my_space_id());
