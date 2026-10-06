DROP POLICY IF EXISTS "Public read catalog-vehicles images" ON storage.objects;
CREATE POLICY "Signed-in read catalog-vehicles images" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'catalog-vehicles' AND auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = ANY (ARRAY['vehicles','icons']));