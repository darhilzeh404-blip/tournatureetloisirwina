
-- 1) Authenticated users can view active partner agencies
DROP POLICY IF EXISTS "Authenticated can view active partner agencies" ON public.partner_agencies;
CREATE POLICY "Authenticated can view active partner agencies"
ON public.partner_agencies
FOR SELECT
TO authenticated
USING (is_active = true);

-- 2) Storage policies for catalogue-images bucket
DROP POLICY IF EXISTS "Catalogue images readable by everyone" ON storage.objects;
CREATE POLICY "Catalogue images readable by everyone"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'catalogue-images');

DROP POLICY IF EXISTS "Catalogue images admin write" ON storage.objects;
CREATE POLICY "Catalogue images admin write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'catalogue-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Catalogue images admin update" ON storage.objects;
CREATE POLICY "Catalogue images admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'catalogue-images' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Catalogue images admin delete" ON storage.objects;
CREATE POLICY "Catalogue images admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'catalogue-images' AND public.has_role(auth.uid(), 'admin'::app_role));
