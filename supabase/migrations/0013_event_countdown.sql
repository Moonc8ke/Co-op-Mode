-- ===========================================================================
-- Co-op Mode migration 0013_event_countdown — opt-in countdowns on events
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- migration 0012_cooked_ratings.sql. Run it in the SAME Supabase
-- project where 0001-0012 already ran. Do not run it in the Bark Park
-- Buddies project.
--
-- What it does:
--   * adds `show_countdown` to events. Off by default; an event only
--     counts down when someone turns it on in the event form. The app
--     treats a missing value as false, so rows read before this ran
--     behave the same as off.
-- ===========================================================================

alter table events
  add column if not exists show_countdown boolean not null default false;
