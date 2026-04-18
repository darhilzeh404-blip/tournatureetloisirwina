-- Add transaction reference + receipt photo to payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS transaction_ref text,
  ADD COLUMN IF NOT EXISTS receipt_url text;

CREATE UNIQUE INDEX IF NOT EXISTS payments_transaction_ref_key
  ON public.payments(transaction_ref) WHERE transaction_ref IS NOT NULL;

-- Create private storage bucket for receipt photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users manage their own folder, admins see all
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
