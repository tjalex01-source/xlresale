-- ============================================================================
-- XLResale — admin
-- Run AFTER schema.sql, schema-additions-auth-profiles.sql, -seller, -buyer.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. WHO IS AN ADMIN
-- ----------------------------------------------------------------------------
-- A separate table rather than a profiles.is_admin column, and that choice is
-- the whole security story: profiles_upsert_own lets anyone update their own
-- profile row, so an is_admin column there would be self-grantable — sign up,
-- PATCH your own row, own the site.
--
-- This table has RLS enabled and NO policies at all, which means anon and
-- authenticated cannot read or write it through PostgREST under any
-- circumstances. Membership is changed only from the SQL editor or with the
-- service role.
create table if not exists public.admins (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- INTENTIONAL: no policy is defined on this table, and that absence IS the
-- enforcement. With RLS on and zero policies, anon and authenticated cannot
-- read or write it through PostgREST under any circumstances; membership is
-- changed only from the SQL editor or with the service role. is_admin() reads
-- it as SECURITY DEFINER and returns nothing but a boolean.
alter table public.admins enable row level security;

-- SECURITY DEFINER so it can see a table nobody else can read. Returns only a
-- boolean, so it leaks nothing about who else is an admin.
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.admins where profile_id = uid);
$$;

revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 2. WHAT ADMINS CAN SEE AND DO
-- ----------------------------------------------------------------------------
-- Added as RLS policies rather than reaching for the service role, so RLS stays
-- the security layer (CLAUDE.md §13). The service role is still needed for
-- auth.users — emails and bans live there and have no RLS path — but every
-- app-table read below goes through these.
drop policy if exists profiles_admin_read on public.profiles;
create policy profiles_admin_read on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists sales_admin_all on public.sales;
create policy sales_admin_all on public.sales
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists sale_items_admin_read on public.sale_items;
create policy sale_items_admin_read on public.sale_items
  for select to authenticated using (public.is_admin());

drop policy if exists watchers_admin_read on public.sale_watchers;
create policy watchers_admin_read on public.sale_watchers
  for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. AUDIT TRAIL
-- ----------------------------------------------------------------------------
-- Every destructive admin action gets a row. Moderating real people's accounts
-- without a record of who did what and why is how a support question becomes
-- an argument nobody can settle.
create table if not exists public.admin_actions (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references public.profiles(id) on delete set null,
  action      text not null,
  target_type text not null,
  target_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists admin_actions_created_ix
  on public.admin_actions (created_at desc);

alter table public.admin_actions enable row level security;

-- Readable by admins; writes go through the service role in the server action,
-- so there is deliberately no insert policy to forge entries through.
drop policy if exists admin_actions_read on public.admin_actions;
create policy admin_actions_read on public.admin_actions
  for select to authenticated using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. ACCOUNT OVERVIEW
-- ----------------------------------------------------------------------------
-- One row per account with the numbers the users screen needs, so the page
-- doesn't fan out into a query per user.
--
-- `is_empty` is the bot heuristic: no handle, no sales, no saves, nothing
-- logged. That is the shape of the ~30 accounts that accumulated before
-- Turnstile went in. It is a hint for a human to look at, never grounds for an
-- automatic action.
create or replace function public.admin_accounts()
returns table (
  id            uuid,
  username      text,
  display_name  text,
  created_at    timestamptz,
  sale_count    bigint,
  saved_count   bigint,
  find_count    bigint,
  wishlist_count bigint,
  is_empty      boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.created_at,
    (select count(*) from public.sales s where s.host_id = p.id),
    (select count(*) from public.sale_watchers w where w.shopper_id = p.id),
    (select count(*) from public.finds f where f.finder_id = p.id),
    (select count(*) from public.wishlists wl where wl.shopper_id = p.id),
    p.username is null
      and not exists (select 1 from public.sales s where s.host_id = p.id)
      and not exists (select 1 from public.sale_watchers w where w.shopper_id = p.id)
      and not exists (select 1 from public.finds f where f.finder_id = p.id)
      and not exists (select 1 from public.wishlists wl where wl.shopper_id = p.id)
  from public.profiles p
  where public.is_admin()          -- the gate; without it this returns nothing
  order by p.created_at desc;
$$;

revoke execute on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
