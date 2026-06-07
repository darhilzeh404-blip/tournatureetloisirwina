-- Fix 1: Tighten gerant circuit name matching to exact (case-insensitive) match
CREATE OR REPLACE FUNCTION public.gerant_has_circuit_named(_user_id uuid, _name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_circuits uc
    JOIN public.circuits c ON c.id = uc.circuit_id
    WHERE uc.user_id = _user_id
      AND _name IS NOT NULL
      AND c.nom ILIKE _name
  )
$function$;

-- Fix 2: Restrict partner-tickets uploads to partner agency owners only
DROP POLICY IF EXISTS "Authenticated upload partner-tickets" ON storage.objects;

CREATE POLICY "Partner agency owners upload partner-tickets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'partner-tickets'
  AND auth.uid() IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM public.partner_agencies WHERE owner_user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);