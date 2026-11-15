-- Couples App — initial schema
-- Run this in the SQL Editor of a NEW Supabase project created just for
-- this app (see README.md). Do not run it in the Bark Park Buddies project.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists items (
  id bigint generated always as identity primary key,
  category text not null
    check (category in ('seasonal', 'longterm', 'date', 'dinner', 'recipe', 'craft', 'places')),
  title text not null,
  notes text not null default '',
  season text
    check (season in ('Spring', 'Summer', 'Fall', 'Winter')),
  status text not null default 'idea'
    check (status in ('idea', 'done')),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  title text not null,
  event_date date not null,
  event_time text not null default '',
  location text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists dinner_proposals (
  id bigint generated always as identity primary key,
  title text not null,
  notes text not null default '',
  suggested_by text not null
    check (suggested_by in ('Andrew', 'Juliette')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'countered')),
  responded_by text
    check (responded_by in ('Andrew', 'Juliette')),
  counter_of_id bigint references dinner_proposals (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create table if not exists memories (
  id bigint generated always as identity primary key,
  caption text not null default '',
  memory_date date not null,
  -- Path inside the `scrapbook-photos` storage bucket. NULL for memories
  -- imported from a backup file, which carries no photo bytes.
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Deliberate design choice: this is a two-person family app. Any signed-in
-- user can read and write every row, and nobody signed out can read or
-- write anything. There is no per-user ownership column, because Andrew
-- and Juliette share everything in the app on purpose. If the app ever
-- grows beyond the two of them, add an owner_id column and tighten these
-- policies before inviting anyone else.
-- ---------------------------------------------------------------------------

alter table items enable row level security;
alter table events enable row level security;
alter table dinner_proposals enable row level security;
alter table memories enable row level security;

drop policy if exists "Authenticated users can read and write" on items;
create policy "Authenticated users can read and write"
  on items for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read and write" on events;
create policy "Authenticated users can read and write"
  on events for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read and write" on dinner_proposals;
create policy "Authenticated users can read and write"
  on dinner_proposals for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can read and write" on memories;
create policy "Authenticated users can read and write"
  on memories for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Storage bucket for scrapbook photos
--
-- The bucket is public so photos can be shown with a plain <img> tag.
-- Only signed-in users can upload, replace, or delete files in it.
-- Photo URLs are effectively unguessable (they include a timestamp and a
-- random suffix), but anyone who has a URL can view that photo.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('scrapbook-photos', 'scrapbook-photos', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view scrapbook photos" on storage.objects;
create policy "Anyone can view scrapbook photos"
  on storage.objects for select
  to public
  using (bucket_id = 'scrapbook-photos');

drop policy if exists "Signed-in users can upload scrapbook photos" on storage.objects;
create policy "Signed-in users can upload scrapbook photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'scrapbook-photos');

drop policy if exists "Signed-in users can replace scrapbook photos" on storage.objects;
create policy "Signed-in users can replace scrapbook photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'scrapbook-photos')
  with check (bucket_id = 'scrapbook-photos');

drop policy if exists "Signed-in users can delete scrapbook photos" on storage.objects;
create policy "Signed-in users can delete scrapbook photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'scrapbook-photos');
