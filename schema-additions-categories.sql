-- ============================================================================
-- XLResale — category tree
-- Run AFTER schema-additions-account.sql.
--
-- Two levels: a parent someone can tick on its own, with optional children for
-- people who want to be specific. A host tagging "Electronics" and nothing else
-- has given a complete answer; nobody filling in a garage-sale form wants to
-- drill through six parents.
--
-- Done now because it is free now: seven sale tags exist and zero wishlists.
-- Once real hosts have tagged real sales this stops being a schema edit and
-- becomes a data migration.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SHAPE
-- ----------------------------------------------------------------------------
alter table public.categories
  add column if not exists parent_id smallint references public.categories(id) on delete cascade,
  add column if not exists position  smallint not null default 0;

create index if not exists categories_parent_ix on public.categories (parent_id);

-- ----------------------------------------------------------------------------
-- 2. THE PARENTS
-- ----------------------------------------------------------------------------
-- The eight originals keep their ids and become parents; three are relabelled
-- because they were doing double duty. "Vinyl / Media" was really books plus
-- records plus films, and "Outdoors" was covering both camping and gardening —
-- exactly the seams that would have been permanent if I'd bolted parents on
-- top of them.
--
-- Colours cycle the four brand hues rather than inventing eighteen of them.
-- The originals had drifted to stock Tailwind colours (sky, amber, emerald),
-- which is how a palette turns generic.
update public.categories set label = 'Tools & Hardware',          color = '#ff2e63', position = 1  where slug = 'tools';
update public.categories set label = 'Furniture',                 color = '#ff9f1c', position = 2  where slug = 'furniture';
update public.categories set label = 'Home & Kitchen',            color = '#12b76a', position = 3  where slug = 'home';
update public.categories set label = 'Clothing & Shoes',          color = '#8b5cf6', position = 6  where slug = 'clothing';
update public.categories set label = 'Baby & Kids',               color = '#ff9f1c', position = 8  where slug = 'baby-kids';
update public.categories set label = 'Outdoors & Camping',        color = '#8b5cf6', position = 11 where slug = 'outdoors';
update public.categories set label = 'Books, Music & Media',      color = '#ff9f1c', position = 13 where slug = 'vinyl';
update public.categories set label = 'Art, Decor & Collectibles', color = '#8b5cf6', position = 14 where slug = 'collectible';

insert into public.categories (slug, label, color, position) values
  ('appliances',  'Appliances',           '#8b5cf6',  4),
  ('electronics', 'Electronics',          '#ff2e63',  5),
  ('jewelry',     'Jewelry & Accessories','#12b76a',  7),
  ('toys-games',  'Toys & Games',         '#12b76a',  9),
  ('sports',      'Sports & Fitness',     '#ff2e63', 10),
  ('garden',      'Garden & Yard',        '#12b76a', 12),
  ('craft',       'Craft & Hobby',        '#ff2e63', 15),
  ('auto',        'Auto & Garage',        '#12b76a', 16),
  ('pets',        'Pet Supplies',         '#ff9f1c', 17),
  ('seasonal',    'Seasonal & Holiday',   '#ff2e63', 18)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 3. THE CHILDREN
-- ----------------------------------------------------------------------------
-- Only where the distinction is something a person actually hunts for. Nobody
-- searches "kitchen linens"; plenty of people search "computer parts" and
-- "retro games", which is the split that prompted this.
insert into public.categories (slug, label, color, position, parent_id)
select v.slug, v.label, p.color, v.position, p.id
from (values
  -- Tools & Hardware
  ('tools',       'tools-hand',        'Hand tools',            1),
  ('tools',       'tools-power',       'Power tools',           2),
  ('tools',       'tools-lawn-power',  'Ladders & workbenches', 3),
  ('tools',       'tools-hardware',    'Hardware & fasteners',  4),
  ('tools',       'tools-building',    'Building materials',    5),
  -- Furniture
  ('furniture',   'furn-living',       'Living room',           1),
  ('furniture',   'furn-bedroom',      'Bedroom',               2),
  ('furniture',   'furn-dining',       'Dining',                3),
  ('furniture',   'furn-office',       'Office',                4),
  ('furniture',   'furn-outdoor',      'Patio & outdoor',       5),
  ('furniture',   'furn-storage',      'Shelving & storage',    6),
  -- Home & Kitchen
  ('home',        'home-cookware',     'Cookware',              1),
  ('home',        'home-dishes',       'Dishes & glassware',    2),
  ('home',        'home-small-appl',   'Small appliances',      3),
  ('home',        'home-linens',       'Linens & bedding',      4),
  ('home',        'home-storage',      'Storage & cleaning',    5),
  -- Appliances
  ('appliances',  'appl-fridge',       'Refrigerators',         1),
  ('appliances',  'appl-laundry',      'Washers & dryers',      2),
  ('appliances',  'appl-range',        'Ranges & ovens',        3),
  ('appliances',  'appl-dishwasher',   'Dishwashers',           4),
  ('appliances',  'appl-freezer',      'Freezers',              5),
  -- Electronics
  ('electronics', 'elec-tv',           'TVs',                   1),
  ('electronics', 'elec-computers',    'Computers & laptops',   2),
  ('electronics', 'elec-parts',        'Computer parts',        3),
  ('electronics', 'elec-games',        'Video games & consoles',4),
  ('electronics', 'elec-audio',        'Audio & speakers',      5),
  ('electronics', 'elec-cameras',      'Cameras',               6),
  ('electronics', 'elec-phones',       'Phones & tablets',      7),
  -- Clothing & Shoes
  ('clothing',    'cloth-womens',      'Women''s',              1),
  ('clothing',    'cloth-mens',        'Men''s',                2),
  ('clothing',    'cloth-kids',        'Kids''',                3),
  ('clothing',    'cloth-shoes',       'Shoes',                 4),
  ('clothing',    'cloth-bags',        'Bags & luggage',        5),
  ('clothing',    'cloth-coats',       'Coats & outerwear',     6),
  -- Jewelry & Accessories
  ('jewelry',     'jewel-fine',        'Fine jewelry',          1),
  ('jewelry',     'jewel-costume',     'Costume jewelry',       2),
  ('jewelry',     'jewel-watches',     'Watches',               3),
  -- Baby & Kids
  ('baby-kids',   'baby-gear',         'Baby gear',             1),
  ('baby-kids',   'baby-strollers',    'Strollers & car seats', 2),
  ('baby-kids',   'baby-furniture',    'Cribs & kids furniture',3),
  ('baby-kids',   'baby-clothing',     'Baby clothing',         4),
  -- Toys & Games
  ('toys-games',  'toys-board',        'Board games & puzzles', 1),
  ('toys-games',  'toys-building',     'Lego & building',       2),
  ('toys-games',  'toys-figures',      'Action figures & dolls',3),
  ('toys-games',  'toys-outdoor',      'Outdoor toys',          4),
  ('toys-games',  'toys-cards',        'Trading cards',         5),
  -- Sports & Fitness
  ('sports',      'sport-exercise',    'Exercise equipment',    1),
  ('sports',      'sport-bikes',       'Bikes',                 2),
  ('sports',      'sport-golf',        'Golf',                  3),
  ('sports',      'sport-hunt-fish',   'Hunting & fishing',     4),
  ('sports',      'sport-team',        'Team sports',           5),
  ('sports',      'sport-water',       'Water sports',          6),
  -- Outdoors & Camping
  ('outdoors',    'out-camping',       'Camping gear',          1),
  ('outdoors',    'out-grills',        'Grills & smokers',      2),
  ('outdoors',    'out-coolers',       'Coolers',               3),
  -- Garden & Yard
  ('garden',      'garden-mowers',     'Mowers & trimmers',     1),
  ('garden',      'garden-tools',      'Garden tools',          2),
  ('garden',      'garden-planters',   'Planters & pots',       3),
  ('garden',      'garden-decor',      'Yard decor',            4),
  -- Books, Music & Media
  ('vinyl',       'media-books',       'Books',                 1),
  ('vinyl',       'media-vinyl',       'Vinyl records',         2),
  ('vinyl',       'media-cds',         'CDs & cassettes',       3),
  ('vinyl',       'media-dvds',        'DVDs & Blu-ray',        4),
  ('vinyl',       'media-instruments', 'Musical instruments',   5),
  -- Art, Decor & Collectibles
  ('collectible', 'coll-antiques',     'Antiques',              1),
  ('collectible', 'coll-art',          'Art & prints',          2),
  ('collectible', 'coll-decor',        'Home decor',            3),
  ('collectible', 'coll-coins',        'Coins & stamps',        4),
  ('collectible', 'coll-vintage',      'Vintage & retro',       5),
  -- Craft & Hobby
  ('craft',       'craft-sewing',      'Sewing & fabric',       1),
  ('craft',       'craft-yarn',        'Yarn & knitting',       2),
  ('craft',       'craft-art',         'Art supplies',          3),
  ('craft',       'craft-scrapbook',   'Scrapbooking',          4),
  -- Auto & Garage
  ('auto',        'auto-parts',        'Car parts',             1),
  ('auto',        'auto-tires',        'Tires & wheels',        2),
  ('auto',        'auto-tools',        'Auto tools',            3),
  ('auto',        'auto-motorcycle',   'Motorcycle & ATV',      4),
  -- Pet Supplies
  ('pets',        'pet-dog',           'Dog',                   1),
  ('pets',        'pet-cat',           'Cat',                   2),
  ('pets',        'pet-other',         'Other pets',            3),
  -- Seasonal & Holiday
  ('seasonal',    'seas-christmas',    'Christmas',             1),
  ('seasonal',    'seas-halloween',    'Halloween',             2),
  ('seasonal',    'seas-other',        'Other holidays',        3)
) as v(parent_slug, slug, label, position)
join public.categories p on p.slug = v.parent_slug and p.parent_id is null
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 4. BUYERS PICK CATEGORIES TOO
-- ----------------------------------------------------------------------------
-- A wishlist used to require a text term. "Alert me about anything in video
-- games within 20 miles" has no term at all, and it is the more natural way to
-- ask — most people know the KIND of thing they want before they know the word
-- for it.
alter table public.wishlists
  add column if not exists category_ids smallint[] not null default '{}';

update public.wishlists
   set category_ids = array[category_id]::smallint[]
 where category_id is not null and category_ids = '{}';

alter table public.wishlists
  alter column term drop not null;

-- One or the other has to be present, or the row means nothing.
alter table public.wishlists
  drop constraint if exists wishlists_have_something;
alter table public.wishlists
  add constraint wishlists_have_something
  check (coalesce(nullif(trim(term), ''), null) is not null or cardinality(category_ids) > 0);

-- ----------------------------------------------------------------------------
-- 5. MATCHING, AND THE PART THAT IS EASY TO GET WRONG
-- ----------------------------------------------------------------------------
-- A buyer's picks expand ONE LEVEL IN BOTH DIRECTIONS, and the sale's tags are
-- left exactly as the host wrote them:
--
--   down  buyer picks Electronics -> a sale tagged "Computer parts" matches,
--         because the child is a kind of the thing they asked for
--   up    buyer picks "Video games" -> a sale tagged only Electronics matches,
--         because the host was unspecific and it might well be in there
--
-- The tempting shortcut is to expand BOTH sides to their ancestors and test for
-- overlap. That quietly matches siblings: a buyer wanting video games would be
-- alerted about a sale of computer parts, because both roll up to Electronics.
-- Expanding only the buyer's side is what keeps siblings apart.
create or replace function public.category_match_set(in_ids smallint[])
returns smallint[]
language sql
stable
as $$
  select coalesce(array_agg(distinct id), '{}')::smallint[]
  from (
    select unnest(in_ids) as id
    union
    select c.id from public.categories c where c.parent_id = any(in_ids)   -- children
    union
    select c.parent_id from public.categories c
     where c.id = any(in_ids) and c.parent_id is not null                  -- parents
  ) s;
$$;

create or replace function public.match_sale_to_wishlists(in_sale_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare inserted int;
begin
  with s as (
    select id, location, search_tsv,
           (select coalesce(array_agg(sc.category_id), '{}')::smallint[]
              from public.sale_categories sc where sc.sale_id = sales.id) as cat_ids
    from public.sales
    where id = in_sale_id and listing_paid = true and hidden_at is null
  )
  insert into public.wishlist_alerts (shopper_id, sale_id, wishlist_id, matched_term, kind)
  select w.shopper_id, s.id, w.id, w.term, 'match'
  from s
  join public.wishlists w on w.active
  join public.profiles  p on p.id = w.shopper_id and p.home_point is not null
  where st_dwithin(s.location, p.home_point, (w.max_miles * 1609.344)::double precision)
    -- A term narrows; it never stands in for the categories.
    and (nullif(trim(coalesce(w.term, '')), '') is null
         or s.search_tsv @@ plainto_tsquery('english', w.term))
    and (cardinality(w.category_ids) = 0
         or s.cat_ids && public.category_match_set(w.category_ids))
  on conflict (shopper_id, sale_id) where kind = 'match' do nothing;

  get diagnostics inserted = row_count;
  return inserted;
end $$;
