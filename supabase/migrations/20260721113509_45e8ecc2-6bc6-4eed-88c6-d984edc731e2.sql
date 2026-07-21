
-- partner_commission_rates: public SELECT policy + admin manage → allow anon read, auth full, admin via role
GRANT SELECT ON public.partner_commission_rates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_commission_rates TO authenticated;
GRANT ALL ON public.partner_commission_rates TO service_role;

-- partner_agencies: admins + agency owners write; authenticated reads their own
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_agencies TO authenticated;
GRANT ALL ON public.partner_agencies TO service_role;

-- group_rides / group_ride_passengers: authenticated users read/write per RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_rides TO authenticated;
GRANT ALL ON public.group_rides TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_ride_passengers TO authenticated;
GRANT ALL ON public.group_ride_passengers TO service_role;

-- Reload PostgREST schema cache so embeds/relationships resurface immediately
NOTIFY pgrst, 'reload schema';
