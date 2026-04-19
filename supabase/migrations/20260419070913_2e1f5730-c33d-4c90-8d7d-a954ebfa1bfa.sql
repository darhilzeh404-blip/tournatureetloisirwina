-- 1. Add paiement_valide flag on reservations (admin manual validation gate)
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS paiement_valide boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_reservations_paiement_valide ON public.reservations(paiement_valide);

-- 2. Seed WhatsApp admin contact in transport_settings (publicly readable, admin-writable)
INSERT INTO public.transport_settings (key, label, description, value)
VALUES
  ('whatsapp_admin_number', 'Numéro WhatsApp admin', 'Numéro WhatsApp (format international sans +) utilisé comme fallback pour l''envoi de preuve de paiement', 0),
  ('whatsapp_fallback_enabled', 'Activer fallback WhatsApp', 'Si 1, affiche le bouton WhatsApp en cas d''échec d''upload de la preuve', 1)
ON CONFLICT (key) DO NOTHING;

-- 3. Add a text column to transport_settings for non-numeric values (phone numbers)
ALTER TABLE public.transport_settings
  ADD COLUMN IF NOT EXISTS text_value text;

UPDATE public.transport_settings
   SET text_value = '24177000000'
 WHERE key = 'whatsapp_admin_number'
   AND text_value IS NULL;