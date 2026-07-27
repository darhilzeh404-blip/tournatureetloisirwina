-- 1) partner_agencies: remove broad SELECT exposing email/phone
DROP POLICY IF EXISTS "Public can view active partner agencies" ON public.partner_agencies;
DROP POLICY IF EXISTS "Authenticated can view active partner agencies" ON public.partner_agencies;
REVOKE SELECT ON public.partner_agencies FROM anon;

-- Public catalog view (safe columns only), readable without base-table access
ALTER VIEW public.partner_agencies_public SET (security_invoker = false);
GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;

-- 2) catalogue-images: restrict public read to the marketing photos folder only
DROP POLICY IF EXISTS "Catalogue images readable by everyone" ON storage.objects;
CREATE POLICY "Catalogue vehicle photos readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'catalogue-images' AND (storage.foldername(name))[1] = 'vehicles');

-- 3) payment-receipts: owner-scoped update/delete with path ownership enforced
DROP POLICY IF EXISTS "Users can update their own receipts" ON storage.objects;
CREATE POLICY "Users can update their own receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own receipts" ON storage.objects;
CREATE POLICY "Users can delete their own receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'payment-receipts' AND (auth.uid())::text = (storage.foldername(name))[1]);