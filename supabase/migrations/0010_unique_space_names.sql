-- ===========================================================================
-- Co-op Mode migration 0010_unique_space_names — one name per person
-- in a space
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- migration 0009_generic_names.sql. Run it in the SAME Supabase project
-- where 0001-0009 already ran. Do not run it in the Bark Park Buddies
-- project.
--
-- What it does:
--   * adds a unique index on profiles (space_id, lower(display_name)),
--     so display names are unique within a space and compared
--     case-insensitively ("Maya" and "maya" count as the same name).
--     Two different spaces may still reuse the same name.
--   * the app checks before saving (setMyProfile in src/lib/data.ts)
--     and shows "That name's already taken in your space, try another
--     one"; the index is the backstop if two people pick the same name
--     at the same moment.
--   * existing rows keep their names — nothing is rewritten.
-- Creating the index fails if two rows in the same space already share
-- a name (case-insensitively). That can't happen today — only Andrew
-- and Juliette exist, with different names — but if it ever does,
-- rename one of the duplicate rows first, then re-run this.
-- ===========================================================================

create unique index if not exists profiles_space_display_name_unique
  on profiles (space_id, lower(display_name));
