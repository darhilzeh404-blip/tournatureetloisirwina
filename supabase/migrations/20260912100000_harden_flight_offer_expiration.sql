-- Only trusted workers should perform the global flight-offer expiration sweep.
REVOKE ALL ON FUNCTION public.expire_flight_offers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_flight_offers() TO service_role;
