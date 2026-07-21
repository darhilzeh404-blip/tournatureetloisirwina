GRANT SELECT ON public.partner_agencies_public TO anon, authenticated;
GRANT SELECT ON public.ticket_categories TO anon, authenticated;
GRANT SELECT ON public.partner_tickets TO anon, authenticated;

NOTIFY pgrst, 'reload schema';