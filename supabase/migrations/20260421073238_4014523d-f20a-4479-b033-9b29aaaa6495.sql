-- Create public bucket for circuit cover images
INSERT INTO storage.buckets (id, name, public)
VALUES ('circuit-images', 'circuit-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view
CREATE POLICY "Public can view circuit images"
ON storage.objects FOR SELECT
USING (bucket_id = 'circuit-images');

-- Admins can upload
CREATE POLICY "Admins can upload circuit images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'circuit-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update circuit images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'circuit-images' AND has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete
CREATE POLICY "Admins can delete circuit images"
ON storage.objects FOR DELETE
USING (bucket_id = 'circuit-images' AND has_role(auth.uid(), 'admin'::app_role));