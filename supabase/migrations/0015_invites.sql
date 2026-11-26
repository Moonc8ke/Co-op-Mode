-- ===========================================================================
-- Co-op Mode migration 0015_invites — invites + space names (Stage 2)
-- ===========================================================================
-- Run by Andrew in the Supabase SQL Editor (Co-op Mode project), after
-- taking the app's built-in JSON export as a backup. Run it in the SAME
-- Supabase project where 0001-0014 already ran. Do not run it in the
-- Bark Park Buddies project. Do not re-run 0001-0014.
--
-- What it does:
--   * adds `kind` ('relationship' | 'family'), `family_name`, and
--     `invite_expires_at` to `spaces`. Existing spaces backfill to
--     kind 'relationship', and their current invite codes get a
--     7-day window from now, matching the new rule (after that, a
--     member regenerates the code from the app).
--   * adds three SECURITY DEFINER functions the app calls for the
--     invite flow. They have to be functions, not plain inserts:
--     `spaces` has no INSERT policy, and a spaceless account cannot
--     read the spaces table at all (its SELECT policy only lets a
--     member read their own space), so it could neither create a
--     space nor look a code up by itself.
--       - create_space(p_kind, p_display_name, p_family_name):
--         creates the space (invite code + 7-day expiry) and the
--         caller's profiles row in it, in one step.
--       - join_space_by_code(p_code, p_display_name): looks the code
--         up, refuses it when it is unknown ('CODE_NOT_FOUND') or
--         expired ('CODE_EXPIRED'), refuses a name another member
--         already uses ('NAME_TAKEN'), then creates the caller's
--         profiles row in that space.
--       - regenerate_invite_code(): swaps in a fresh code with a new
--         7-day expiry for the caller's own space; the old code
--         stops working immediately.
--   * the app reads the space's name from its members (see
--     deriveSpaceName in src/lib/data.ts), so the stored `name`
--     column is only a creation-time label now: a relationship space
--     is "Brian's space" / "Brian and Luisa's space" / "Brian,
--     Luisa, and Sarah's space" as people join, and a family space
--     is "the Smith family space".
--
-- The app change that goes with this migration is in src/lib/data.ts
-- (createMySpace / joinSpaceByCode / regenerateInviteCode /
-- getMySpaceInfo), src/components/space-setup.tsx (the spaceless
-- setup flow and the invite card), and src/components/CouplesApp.tsx.
-- Deploy order: run this migration FIRST, then push the code.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Columns on spaces
-- ---------------------------------------------------------------------------

alter table spaces
  add column if not exists kind text not null default 'relationship'
    check (kind in ('relationship', 'family'));
alter table spaces
  add column if not exists family_name text;
alter table spaces
  add column if not exists invite_expires_at timestamptz;

-- Existing codes get a 7-day window from now, so the rule applies to
-- every space the same way. Re-runnable: only rows with no expiry
-- yet are touched.
update spaces
  set invite_expires_at = now() + interval '7 days'
  where invite_expires_at is null;

-- ---------------------------------------------------------------------------
-- create_space — a spaceless account creates its own space
-- ---------------------------------------------------------------------------

create or replace function public.create_space(
  p_kind text,
  p_display_name text,
  p_family_name text default null
)
returns table (
  space_id uuid,
  invite_code text,
  invite_expires_at timestamptz,
  space_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_space_id uuid;
  v_code text;
  v_expires timestamptz := now() + interval '7 days';
  v_name text;
  v_attempts int := 0;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_kind not in ('relationship', 'family') then
    raise exception 'invalid space kind';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'name required';
  end if;
  if p_kind = 'family' and (p_family_name is null or btrim(p_family_name) = '') then
    raise exception 'family name required';
  end if;
  if exists (
    select 1 from public.profiles
    where id = v_user and space_id is not null
  ) then
    raise exception 'already in a space';
  end if;

  v_name := case
    when p_kind = 'family'
      then 'the ' || btrim(p_family_name) || ' family space'
    else btrim(p_display_name) || '''s space'
  end;

  -- A 12-hex-char code collides only in theory; retry a few times
  -- on the unique index instead of failing the whole call.
  loop
    v_attempts := v_attempts + 1;
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    begin
      insert into public.spaces (name, kind, family_name, invite_code, invite_expires_at)
        values (v_name, p_kind, nullif(btrim(p_family_name), ''), v_code, v_expires)
        returning id into v_space_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then raise; end if;
    end;
  end loop;

  insert into public.profiles (id, display_name, space_id)
    values (v_user, btrim(p_display_name), v_space_id)
    on conflict (id) do update
      set display_name = excluded.display_name,
          space_id = excluded.space_id;

  return query select v_space_id, v_code, v_expires, v_name;
end $$;

-- ---------------------------------------------------------------------------
-- join_space_by_code — a spaceless account joins a space with a code
-- ---------------------------------------------------------------------------

create or replace function public.join_space_by_code(
  p_code text,
  p_display_name text
)
returns table (
  space_id uuid,
  space_name text,
  space_kind text,
  family_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_space public.spaces%rowtype;
begin
  if v_user is null then
    raise exception 'not signed in';
  end if;
  if p_display_name is null or btrim(p_display_name) = '' then
    raise exception 'name required';
  end if;

  select * into v_space
    from public.spaces
    where invite_code = lower(btrim(p_code));
  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;
  if v_space.invite_expires_at is not null
     and v_space.invite_expires_at < now() then
    raise exception 'CODE_EXPIRED';
  end if;
  if exists (
    select 1 from public.profiles
    where id = v_user and space_id is not null
  ) then
    raise exception 'already in a space';
  end if;
  if exists (
    select 1 from public.profiles
    where space_id = v_space.id
      and lower(display_name) = lower(btrim(p_display_name))
      and id <> v_user
  ) then
    raise exception 'NAME_TAKEN';
  end if;

  begin
    insert into public.profiles (id, display_name, space_id)
      values (v_user, btrim(p_display_name), v_space.id)
      on conflict (id) do update
        set display_name = excluded.display_name,
            space_id = excluded.space_id;
  exception when unique_violation then
    -- Two people joining with the same name at the same moment:
    -- the unique index (migration 0010) rejected the second save.
    raise exception 'NAME_TAKEN';
  end;

  return query select v_space.id, v_space.name, v_space.kind, v_space.family_name;
end $$;

-- ---------------------------------------------------------------------------
-- regenerate_invite_code — a member swaps in a fresh code for their space
-- ---------------------------------------------------------------------------

create or replace function public.regenerate_invite_code()
returns table (
  invite_code text,
  invite_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid := public.my_space_id();
  v_code text;
  v_expires timestamptz := now() + interval '7 days';
  v_attempts int := 0;
begin
  if v_space_id is null then
    raise exception 'no space';
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_code := substr(md5(random()::text || clock_timestamp()::text), 1, 12);
    begin
      update public.spaces
        set invite_code = v_code,
            invite_expires_at = v_expires
        where id = v_space_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 10 then raise; end if;
    end;
  end loop;

  return query select v_code, v_expires;
end $$;

-- ---------------------------------------------------------------------------
-- Grants: signed-in users may call the three functions; anonymous
-- visitors may not. (SECURITY DEFINER runs them with the function
-- owner's rights, so no RLS policy change is needed.)
-- ---------------------------------------------------------------------------

revoke all on function public.create_space(text, text, text) from public;
grant execute on function public.create_space(text, text, text) to authenticated;

revoke all on function public.join_space_by_code(text, text) from public;
grant execute on function public.join_space_by_code(text, text) to authenticated;

revoke all on function public.regenerate_invite_code() from public;
grant execute on function public.regenerate_invite_code() to authenticated;
