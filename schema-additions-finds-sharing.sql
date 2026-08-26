-- ============================================================================
-- XLResale — the finds bucket, and the share page's read path
-- Run AFTER schema-additions-focus.sql.
--
-- `finds.photo_path` has existed since schema-additions-auth-profiles.sql, and
-- has been null on every row ever written, because the bucket it points into
-- was left as a dashboard step in that file's §7 and nobody ever clicked it.
-- Doing it in SQL instead: a bucket is a row in storage.buckets, and a
-- migration that creates what it depends on can be re-run on a fresh project
-- without a checklist.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. THE BUCKET
-- ----------------------------------------------------------------------------
-- Public read, because the whole point of a find is that a stranger opens the
-- link. Same limits as sale-photos so there is one answer to "how big can a
-- photo be" — and the mime allow-list is what stops the bucket being used as
-- general file hosting.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finds', 'finds', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. WHO MAY WRITE INTO IT
-- ----------------------------------------------------------------------------
-- Layout is <finder_id>/<random>.<ext>. The first path segment is the owner,
-- which is the only thing these policies check — the same shape as the
-- sale-photos policies in schema.sql §9b, deliberately, so there is one rule to
-- remember. The client builds the path; it never comes from the file name, or a
-- name like "../../someone-else/x.jpg" would walk out of the folder.
--
-- Note the path does NOT contain the find id. A photo is uploaded before the
-- find row exists — a Server Action body is capped at 1MB and a phone photo is
-- not, so the browser uploads straight to storage and posts back only the path.
drop policy if exists finds_object_read on storage.objects;
create policy finds_object_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'finds');

drop policy if exists finds_object_insert on storage.objects;
create policy finds_object_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'finds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists finds_object_update on storage.objects;
create policy finds_object_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'finds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists finds_object_delete on storage.objects;
create policy finds_object_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'finds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- 3. THE SHARE PAGE NEEDS NOTHING NEW
-- ----------------------------------------------------------------------------
-- Recorded so the next person doesn't go looking for the view that isn't here:
--
--   * finds_public_read already lets anon select any find with is_public = true.
--     That is what a share page is.
--   * The finder's handle comes from public_profiles, which only lists profiles
--     that opted in. A public find by a private profile therefore renders
--     unattributed rather than quietly overriding that choice — the find was
--     made public, the person wasn't.
--   * finds carries no location. sale_id is a link to a sale, and every sale is
--     already behind the address-precision rules in
--     schema-additions-address-policy.sql, so sharing a find cannot leak a host
--     address that the sale page wouldn't have shown anyway.
