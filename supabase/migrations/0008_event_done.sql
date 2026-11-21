-- Couples App — mark calendar events done (migration 0008)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql, 0002_cravings.sql, 0003_profiles.sql,
-- 0004_dinner_dates.sql, 0005_tell_you_later.sql, and
-- 0006_push_subscriptions.sql already ran (see README.md). Do not run
-- it in the Bark Park Buddies project. Do not re-run 0001-0006; this
-- file only adds two columns to the events table.
--
-- The Edit feature works without this migration. Marking a plan done
-- needs it: until these columns exist, the "Mark as done" button shows
-- a friendly note asking for this migration instead of saving.

-- ---------------------------------------------------------------------------
-- Columns
--
-- is_done / done_at follow the same done-state pattern as bucket-list
-- items (items.status / done_at) and tell_you_later (is_done /
-- done_at). Done plans leave the "Coming up" list and show in a
-- collapsible done list instead; nothing is deleted.
-- ---------------------------------------------------------------------------

alter table events add column if not exists is_done boolean not null default false;
alter table events add column if not exists done_at timestamptz;
