-- 0014_storage_private.sql
--
-- Makes the scrapbook-photos bucket private: only members of a space
-- can view, upload, or delete that space's photos. New uploads go
-- under <space_id>/memories/... (see addMemory in src/lib/data.ts)
-- and the app displays photos with short-lived signed URLs.
--
-- Existing photos still live at the old memories/... paths. They are
-- NOT moved: the view/delete rules below also allow a photo when a
-- memories row for the signed-in user's space points at it, so old
-- photos keep working and stay visible only to their own space.
-- The bucket itself must be private for any of this to matter; the
-- first statement below does that (or flip it in the dashboard:
-- Storage > scrapbook-photos > Edit bucket > turn off "Public").
-- ---------------------------------------------------------------------------

-- Flip the bucket from public to private.
update storage.buckets
set public = false
where id = 'scrapbook-photos';

-- Drop the old rules (public viewing, any signed-in user can write).
drop policy if exists "Anyone can view scrapbook photos" on storage.objects;
drop policy if exists "Signed-in users can upload scrapbook photos" on storage.objects;
drop policy if exists "Signed-in users can replace scrapbook photos" on storage.objects;
drop policy if exists "Signed-in users can delete scrapbook photos" on storage.objects;

-- Viewing: only my own space's folder, or an older photo whose
-- memories row belongs to my space.
create policy "Space members can view their space photos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'scrapbook-photos'
    and (
      name like public.my_space_id()::text || '/%'
      or exists (
        select 1 from public.memories m
        where m.storage_path = storage.objects.name
          and m.space_id = public.my_space_id()
      )
    )
  );

-- Uploading: only into my own space's folder.
create policy "Space members can upload to their space folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'scrapbook-photos'
    and name like public.my_space_id()::text || '/%'
  );

-- Replacing: only inside my own space's folder.
create policy "Space members can replace their space photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'scrapbook-photos'
    and name like public.my_space_id()::text || '/%'
  )
  with check (
    bucket_id = 'scrapbook-photos'
    and name like public.my_space_id()::text || '/%'
  );

-- Deleting: my own space's folder, or an older photo whose memories
-- row belongs to my space.
create policy "Space members can delete their space photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'scrapbook-photos'
    and (
      name like public.my_space_id()::text || '/%'
      or exists (
        select 1 from public.memories m
        where m.storage_path = storage.objects.name
          and m.space_id = public.my_space_id()
      )
    )
  );
