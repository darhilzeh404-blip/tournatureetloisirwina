
-- 1) partner-tickets bucket: scope public reads to known public folders only
DROP POLICY IF EXISTS "Public read partner-tickets" ON storage.objects;
CREATE POLICY "Public read partner-tickets scoped"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'partner-tickets'
  AND (storage.foldername(name))[1] IN ('agency-logos', 'tickets', 'vessels', 'flights')
);

-- 2) catalogue-images: keep folder scoping but require a real nested object path
DROP POLICY IF EXISTS "Catalogue vehicle photos readable" ON storage.objects;
CREATE POLICY "Catalogue vehicle photos readable"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'catalogue-images'
  AND (storage.foldername(name))[1] = 'vehicles'
  AND array_length(storage.foldername(name), 1) >= 1
  AND name NOT LIKE '%..%'
);

-- 3) group ride passenger PII: cut off driver visibility after ride completion/archive
CREATE OR REPLACE FUNCTION public.get_group_ride_passengers_for_driver(_ride_id uuid)
RETURNS TABLE(id uuid, ride_id uuid, user_id uuid, seat_index smallint, commune_pickup text, commune_destination text, status text, joined_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.ride_id, p.user_id, p.seat_index,
         p.commune_pickup, p.commune_destination,
         p.status::text, p.joined_at
  FROM public.group_ride_passengers p
  JOIN public.group_rides r ON r.id = p.ride_id
  WHERE p.ride_id = _ride_id
    AND public.is_group_ride_driver(auth.uid(), _ride_id)
    AND (
      COALESCE(r.archived_at, r.completed_at) IS NULL
      OR COALESCE(r.archived_at, r.completed_at) > now() - interval '6 hours'
    );
$function$;
