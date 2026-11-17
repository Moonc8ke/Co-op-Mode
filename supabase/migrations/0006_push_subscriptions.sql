-- Couples App — push notification subscriptions (migration 0006)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql through 0005_tell_you_later.sql already ran
-- (see README.md). Do not run it in the Bark Park Buddies project. Do
-- not re-run 0001–0005; this file only adds the push_subscriptions
-- table.

-- ---------------------------------------------------------------------------
-- Table
--
-- One row per phone (or browser) that has enabled push notifications.
-- The browser gives each subscription an endpoint URL plus two keys;
-- the Edge Function (supabase/functions/send-push) uses them to send a
-- notification to that device. The endpoint is unique, so the same
-- phone can never be saved twice.
--
-- Unlike the shared tables, subscriptions are NOT shared between the
-- two of you: each person can only read, write, and delete their own
-- rows. The Edge Function reads subscriptions with the service role
-- key, which bypasses these policies, so it can notify the *other*
-- person when one of you posts something.
-- ---------------------------------------------------------------------------

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- A signed-in user can only touch their own subscriptions. Nobody
-- signed out can touch any of them.
-- ---------------------------------------------------------------------------

alter table push_subscriptions enable row level security;

drop policy if exists "Users can read their own subscriptions" on push_subscriptions;
create policy "Users can read their own subscriptions"
  on push_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can save their own subscriptions" on push_subscriptions;
create policy "Users can save their own subscriptions"
  on push_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own subscriptions" on push_subscriptions;
create policy "Users can update their own subscriptions"
  on push_subscriptions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own subscriptions" on push_subscriptions;
create policy "Users can delete their own subscriptions"
  on push_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);
