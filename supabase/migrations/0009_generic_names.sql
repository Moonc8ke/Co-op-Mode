-- ===========================================================================
-- Co-op Mode migration 0009_generic_names — free-form names, any number
-- of people per space
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- migration 0007_spaces.sql. Run it in the SAME Supabase project where
-- 0001-0008 already ran. Do not run it in the Bark Park Buddies project.
--
-- What it does:
--   * drops the name check constraints that limited every name column
--     to 'Andrew' or 'Juliette' — profiles.display_name,
--     dinner_proposals.suggested_by / responded_by,
--     cravings.wanted_by / fulfilled_by,
--     tell_you_later.wanted_by / done_by. The constraints were created
--     inline (unnamed), so Postgres named them {table}_{column}_check;
--     DROP ... IF EXISTS keeps the migration safe to re-run.
--   * existing rows keep their names — nothing is rewritten.
--   * after this, any member of a space can type any name in the app's
--     "Who are you?" picker, and push notifications go to every other
--     member of the space, not just one other partner.
-- Assigning a new member to a space is still done by Andrew in SQL
-- (a profiles row with space_id); there is no invite/join flow yet.
-- ===========================================================================

alter table profiles
  drop constraint if exists profiles_display_name_check;

alter table dinner_proposals
  drop constraint if exists dinner_proposals_suggested_by_check;

alter table dinner_proposals
  drop constraint if exists dinner_proposals_responded_by_check;

alter table cravings
  drop constraint if exists cravings_wanted_by_check;

alter table cravings
  drop constraint if exists cravings_fulfilled_by_check;

alter table tell_you_later
  drop constraint if exists tell_you_later_wanted_by_check;

alter table tell_you_later
  drop constraint if exists tell_you_later_done_by_check;
