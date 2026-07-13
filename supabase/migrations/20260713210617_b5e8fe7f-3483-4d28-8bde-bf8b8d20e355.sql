
CREATE POLICY "Public read catalog-vehicles images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog-vehicles');

CREATE POLICY "Admins insert catalog-vehicles images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'catalog-vehicles' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update catalog-vehicles images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog-vehicles' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete catalog-vehicles images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog-vehicles' AND public.has_role(auth.uid(), 'admin'::app_role));
