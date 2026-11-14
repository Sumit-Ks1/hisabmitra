-- HisabMitra · 0007 · Private storage buckets
-- Object names always start with the owner's user id:  {owner_id}/{...}
-- No bucket is public. Files are only ever served through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tenant-documents', 'tenant-documents', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('meter-photos', 'meter-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy hm_objects_select_own on storage.objects for select to authenticated
  using (
    bucket_id in ('tenant-documents', 'payment-proofs', 'meter-photos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- the admin can open payment screenshots while reviewing — nothing else
create policy hm_objects_select_admin_proofs on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and private.is_admin());

create policy hm_objects_insert_own on storage.objects for insert to authenticated
  with check (
    (storage.foldername(name))[1] = (select auth.uid())::text
    and (
      bucket_id in ('payment-proofs', 'avatars')
      or (bucket_id in ('tenant-documents', 'meter-photos') and private.is_active_owner())
    )
  );

create policy hm_objects_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id in ('tenant-documents', 'payment-proofs', 'meter-photos', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
