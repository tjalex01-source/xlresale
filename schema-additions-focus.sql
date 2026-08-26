-- ============================================================================
-- XLResale — what someone came here for
-- Run AFTER schema-additions-categories.sql.
--
-- One nullable column recording whether somebody thinks of themselves as a
-- shopper, a host, or both. It orders the account page and decides where a
-- plain sign-in lands. That is all it does.
--
-- WHY IT IS NOT CALLED `role`. In a Supabase project `role` already means
-- anon / authenticated / service_role, and `auth.users` has a column by that
-- name. A `profiles.role` sitting next to twenty RLS policies is an invitation
-- for somebody later to gate access on it — on a preference the person picked
-- for themselves, in one tap, and can change back just as fast. `focus` cannot
-- be misread that way. This is a UI preference and must never become an
-- authorisation check.
--
-- NULL IS LOAD-BEARING: it means "never asked", which is what puts the chooser
-- in front of someone. Every account that exists today is therefore null and
-- gets the question once, on its next sign-in.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_focus') then
    create type public.profile_focus as enum ('shopping', 'selling', 'both');
  end if;
end $$;

alter table public.profiles
  add column if not exists focus public.profile_focus;

comment on column public.profiles.focus is
  'Which side of the marketplace this person came for. Orders the account page '
  'and picks where a plain sign-in lands. NULL = never asked. A UI preference, '
  'never an authorisation check.';

-- No policy and no grant below, deliberately, so the next person doesn't go
-- looking for the ones that are missing:
--
--   * profiles_upsert_own already covers this — the whole row is writable by
--     its owner and by nobody else, so the chooser needs no service key.
--   * profiles was never column-revoked the way sales was
--     (schema-additions-security.sql §2 records why), so a table-level grant
--     already covers a new column. Nothing to re-grant.
--   * public_profiles is a fixed select list and does not expand, so this stays
--     off the public surface without being excluded from anything.
