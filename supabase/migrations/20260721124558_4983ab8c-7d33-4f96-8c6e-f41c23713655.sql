GRANT SELECT ON public.partner_agencies_public TO anon;
GRANT SELECT ON public.partner_tickets TO anon;
NOTIFY pgrst, 'reload schema';