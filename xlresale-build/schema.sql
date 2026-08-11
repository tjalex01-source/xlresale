-- ============================================================================
-- HAUL — garage sale discovery app
-- Supabase schema (Postgres + PostGIS + RLS + Realtime)
--
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor → New query
--   2. Paste this whole file and click "Run"
--   3. It's safe to re-run — everything uses IF NOT EXISTS / CREATE OR REPLACE
--
-- WHAT IT SETS UP:
--   • profiles          → one row per user (host and/or shopper)
--   • categories        → the color-coded tags for pins/filters
--   • sales             → the listings, with a live-status lifecycle
--   • sale_categories   → which categories each sale has
--   • saved_routes      → a shopper's planned loop of stops
--   • sale_watchers     → who has a sale on their route ("7 shoppers watching")
--   • notification_prefs→ email/push/SMS toggles + SMS opt-in consent record
--   • sales_near()      → "find sales within X miles of me" (map query)
--   • auto-close job    → flips sales to 'closed' after their closing time
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;      -- geo/distance
create extension if not exists pg_cron with schema extensions;      -- scheduled auto-close


-- ----------------------------------------------------------------------------
-- 2. ENUM: the sale lifecycle (single source of truth both sides read)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'sale_status') then
    create type public.sale_status as enum (
      'scheduled',     -- paid & listed, not started yet
      'live',          -- host tapped Go Live — open right now (green pulse)
      'winding_down',  -- last call, make offers (amber)
      'closed'         -- done for the day (greyed out)
    );
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 3. TABLES
-- ----------------------------------------------------------------------------

-- 3a. PROFILES — 1:1 with auth.users. Any profile can host sales and/or shop.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  -- home base: used as the route start point and the center of "near me"
  home_point   geography(point, 4326),
  home_address text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3b. CATEGORIES — fixed lookup that drives pin colors + search filters
create table if not exists public.categories (
  id    smallserial primary key,
  slug  text unique not null,
  label text not null,
  color text not null            -- hex, matches the app's pin/tag colors
);

-- 3c. SALES — the core listing
create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  host_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  description     text,               -- cleaned copy (AI-tidied)
  raw_description text,               -- original text, kept for reference
  address         text not null,
  location        geography(point, 4326) not null,
  sale_date       date not null,
  opens_at        time not null,
  closes_at       time not null,
  status          public.sale_status not null default 'scheduled',
  went_live_at    timestamptz,        -- stamped when host goes live
  listing_paid    boolean not null default false,  -- true after the $5 Stripe payment
  stripe_payment_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3d. SALE_CATEGORIES — many-to-many join
create table if not exists public.sale_categories (
  sale_id     uuid not null references public.sales(id) on delete cascade,
  category_id smallint not null references public.categories(id) on delete cascade,
  primary key (sale_id, category_id)
);

-- 3e. SAVED_ROUTES — a shopper's ordered loop for a given day
--     stop_ids is an ordered array; the app reorders it and saves the whole array.
create table if not exists public.saved_routes (
  id         uuid primary key default gen_random_uuid(),
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  name       text not null default 'My route',
  route_date date not null,
  stop_ids   uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3f. SALE_WATCHERS — who currently has a sale on a route (powers the host count)
create table if not exists public.sale_watchers (
  sale_id    uuid not null references public.sales(id) on delete cascade,
  shopper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sale_id, shopper_id)
);

-- 3g. NOTIFICATION_PREFS — channel toggles + the SMS opt-in compliance record
create table if not exists public.notification_prefs (
  profile_id      uuid primary key references public.profiles(id) on delete cascade,
  email_enabled   boolean not null default true,
  push_enabled    boolean not null default false,
  sms_enabled     boolean not null default false,
  sms_phone       text,
  sms_consent_at  timestamptz,        -- WHEN they ticked the box (A2P/TCPA proof)
  sms_consent_text text,              -- the EXACT wording they agreed to
  radius_miles    integer not null default 5,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);


-- ----------------------------------------------------------------------------
-- 4. INDEXES
-- ----------------------------------------------------------------------------
create index if not exists sales_location_gix  on public.sales using gist (location);
create index if not exists sales_date_status_ix on public.sales (sale_date, status);
create index if not exists sales_host_ix        on public.sales (host_id);
create index if not exists sale_cat_cat_ix      on public.sale_categories (category_id);
create index if not exists routes_shopper_ix    on public.saved_routes (shopper_id);
create index if not exists watchers_shopper_ix  on public.sale_watchers (shopper_id);


-- ----------------------------------------------------------------------------
-- 5. TRIGGERS: keep updated_at fresh + stamp went_live_at + create profile rows
-- ----------------------------------------------------------------------------

-- 5a. generic updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_sales_touch on public.sales;
create trigger trg_sales_touch before update on public.sales
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_routes_touch on public.saved_routes;
create trigger trg_routes_touch before update on public.saved_routes
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_prefs_touch on public.notification_prefs;
create trigger trg_prefs_touch before update on public.notification_prefs
  for each row execute function public.touch_updated_at();

-- 5b. stamp went_live_at the first time a sale flips to 'live'
create or replace function public.stamp_went_live()
returns trigger language plpgsql as $$
begin
  if new.status = 'live' and (old.status is distinct from 'live') and new.went_live_at is null then
    new.went_live_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_sales_live on public.sales;
create trigger trg_sales_live before update on public.sales
  for each row execute function public.stamp_went_live();

-- 5c. auto-create a profile + default notification prefs when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
    values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
  insert into public.notification_prefs (profile_id)
    values (new.id)
    on conflict (profile_id) do nothing;
  return new;
end $$;

drop trigger if exists trg_auth_new_user on auth.users;
create trigger trg_auth_new_user after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 6. THE MAP QUERY: sales within X miles, on a date, nearest first
--    Called from the app as an RPC: supabase.rpc('sales_near', {...})
-- ----------------------------------------------------------------------------
create or replace function public.sales_near(
  in_lat    double precision,
  in_lng    double precision,
  in_miles  double precision default 5,
  on_date   date default current_date
)
returns table (
  id             uuid,
  host_id        uuid,
  title          text,
  description    text,
  address        text,
  lat            double precision,
  lng            double precision,
  sale_date      date,
  opens_at       time,
  closes_at      time,
  status         public.sale_status,
  distance_miles double precision,
  categories     text[]
)
language sql stable as $$
  select
    s.id, s.host_id, s.title, s.description, s.address,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    s.sale_date, s.opens_at, s.closes_at, s.status,
    st_distance(
      s.location,
      st_point(in_lng, in_lat)::geography
    ) / 1609.344 as distance_miles,
    coalesce(array_agg(c.slug) filter (where c.slug is not null), '{}') as categories
  from public.sales s
  left join public.sale_categories sc on sc.sale_id = s.id
  left join public.categories c       on c.id = sc.category_id
  where s.listing_paid = true
    and s.sale_date = on_date
    and st_dwithin(
          s.location,
          st_point(in_lng, in_lat)::geography,
          in_miles * 1609.344
        )
  group by s.id
  order by distance_miles asc;
$$;


-- ----------------------------------------------------------------------------
-- 7. AUTO-CLOSE: flip any sale to 'closed' once its closing time has passed.
--    Solves "driving out to a sale that already packed up."
-- ----------------------------------------------------------------------------
create or replace function public.close_expired_sales()
returns void language sql as $$
  update public.sales
  set status = 'closed'
  where status <> 'closed'
    and (sale_date + closes_at) < now();
$$;

-- run every 5 minutes (safe to re-run; unschedule first if it exists)
do $$
begin
  perform cron.unschedule('haul-auto-close');
exception when others then null;
end $$;
select cron.schedule('haul-auto-close', '*/5 * * * *', $$ select public.close_expired_sales(); $$);


-- ----------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.sales              enable row level security;
alter table public.sale_categories    enable row level security;
alter table public.saved_routes       enable row level security;
alter table public.sale_watchers      enable row level security;
alter table public.notification_prefs enable row level security;

-- PROFILES: you can see and edit only your own
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
drop policy if exists profiles_upsert_own on public.profiles;
create policy profiles_upsert_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- CATEGORIES: readable by everyone (drives the public map)
drop policy if exists categories_read_all on public.categories;
create policy categories_read_all on public.categories
  for select to anon, authenticated using (true);

-- SALES: anyone may read PAID/published sales; a host fully controls their own
drop policy if exists sales_read_public on public.sales;
create policy sales_read_public on public.sales
  for select to anon, authenticated using (listing_paid = true);
drop policy if exists sales_read_own on public.sales;
create policy sales_read_own on public.sales
  for select to authenticated using (host_id = auth.uid());
drop policy if exists sales_insert_own on public.sales;
create policy sales_insert_own on public.sales
  for insert to authenticated with check (host_id = auth.uid());
drop policy if exists sales_update_own on public.sales;
create policy sales_update_own on public.sales
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists sales_delete_own on public.sales;
create policy sales_delete_own on public.sales
  for delete to authenticated using (host_id = auth.uid());

-- SALE_CATEGORIES: readable when the sale is public; writable by the sale's host
drop policy if exists salecat_read on public.sale_categories;
create policy salecat_read on public.sale_categories
  for select to anon, authenticated using (
    exists (select 1 from public.sales s
            where s.id = sale_id and (s.listing_paid = true or s.host_id = auth.uid()))
  );
drop policy if exists salecat_write on public.sale_categories;
create policy salecat_write on public.sale_categories
  for all to authenticated using (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  ) with check (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  );

-- SAVED_ROUTES: fully private to the shopper who owns them
drop policy if exists routes_own on public.saved_routes;
create policy routes_own on public.saved_routes
  for all to authenticated using (shopper_id = auth.uid()) with check (shopper_id = auth.uid());

-- SALE_WATCHERS: a shopper manages their own rows; a host may READ watchers of their sales
drop policy if exists watchers_shopper on public.sale_watchers;
create policy watchers_shopper on public.sale_watchers
  for all to authenticated using (shopper_id = auth.uid()) with check (shopper_id = auth.uid());
drop policy if exists watchers_host_read on public.sale_watchers;
create policy watchers_host_read on public.sale_watchers
  for select to authenticated using (
    exists (select 1 from public.sales s where s.id = sale_id and s.host_id = auth.uid())
  );

-- NOTIFICATION_PREFS: private to the owner
drop policy if exists prefs_own on public.notification_prefs;
create policy prefs_own on public.notification_prefs
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 9. REALTIME: broadcast sale changes so live pins update instantly
-- ----------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.sales;
exception when duplicate_object then null;
end $$;


-- ----------------------------------------------------------------------------
-- 10. SEED: categories (colors match the app's pins/tags)
-- ----------------------------------------------------------------------------
insert into public.categories (slug, label, color) values
  ('tools',       'Tools',          '#FF2E63'),
  ('vinyl',       'Vinyl / Media',  '#8B5CF6'),
  ('furniture',   'Furniture',      '#F59E0B'),
  ('baby-kids',   'Baby & Kids',    '#38BDF8'),
  ('clothing',    'Clothing',       '#EC4899'),
  ('outdoors',    'Outdoors',       '#10B981'),
  ('collectible', 'Collectibles',   '#EAB308'),
  ('home',        'Home & Kitchen', '#F97316')
on conflict (slug) do nothing;


-- ----------------------------------------------------------------------------
-- 11. OPTIONAL — insert a test sale to see something on the map.
--     After you create your own account, replace YOUR-PROFILE-UUID with your
--     id (find it in Authentication → Users), then uncomment and run this block.
-- ----------------------------------------------------------------------------
-- insert into public.sales
--   (host_id, title, description, address, location, sale_date, opens_at, closes_at, status, listing_paid)
-- values
--   ('YOUR-PROFILE-UUID',
--    'Multi-family — tools, vinyl & mid-century finds',
--    'Power tools, records, teak credenza, Pyrex, camping gear, kids bikes.',
--    '3712 E Standish Ave, Anaheim, CA',
--    st_point(-117.9145, 33.8366)::geography,   -- lng, lat
--    current_date, '08:00', '13:00', 'scheduled', true);

-- ============================================================================
-- END. Next: wire Stripe ($5 listing → sets listing_paid = true) and call
-- sales_near() from the map. Ask Claude for either when you're ready.
-- ============================================================================
