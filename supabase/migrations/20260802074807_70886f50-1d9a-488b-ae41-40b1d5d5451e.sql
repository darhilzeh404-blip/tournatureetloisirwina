ALTER TABLE public.flight_quote_offers REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flight_quote_offers;