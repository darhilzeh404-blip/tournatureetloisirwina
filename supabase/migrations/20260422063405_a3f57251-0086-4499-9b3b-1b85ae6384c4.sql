INSERT INTO public.transport_settings (key, label, description, value, text_value)
VALUES ('whatsapp_admin_number', 'Numéro WhatsApp admin', 'Numéro WhatsApp pour réception des preuves de paiement', 0, '+241077110995')
ON CONFLICT (key) DO UPDATE SET text_value = EXCLUDED.text_value, updated_at = now();

INSERT INTO public.transport_settings (key, label, description, value, text_value)
VALUES ('whatsapp_fallback_enabled', 'Fallback WhatsApp activé', 'Active le bouton WhatsApp en secours', 1, NULL)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();