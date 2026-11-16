-- Couples App — dinner dates (migration 0004)
-- Run this in the SQL Editor of the SAME Supabase project where
-- 0001_couples_app.sql, 0002_cravings.sql, and 0003_profiles.sql
-- already ran (see README.md). Do not run it in the Bark Park Buddies
-- project. Do not re-run 0001, 0002, or 0003; this file only adds the
-- dinner_date column.

-- ---------------------------------------------------------------------------
-- Column
--
-- A date on each dinner suggestion, so the "Dinner this week" board can
-- lay suggestions out by day like the calendar does, instead of a
-- same-night decider. The suggester picks the day; it defaults to today
-- so last-minute nights still work the same.
--
-- Nullable: suggestions saved before this change have no date and keep
-- working; the app shows them under "No day picked yet". A counter
-- keeps the same date as the suggestion it answers, since it is for the
-- same night.
-- ---------------------------------------------------------------------------

alter table dinner_proposals
  add column if not exists dinner_date date;
