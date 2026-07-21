-- Activate agencies that have active tickets so they appear in the public category listings.
-- Root cause of "clicking a transport category shows nothing": agencies were created inactive
-- while tickets attached to them were active, so the category page filtered them out.
UPDATE public.partner_agencies pa
SET is_active = true
WHERE pa.is_active = false
  AND EXISTS (
    SELECT 1 FROM public.partner_tickets pt
    WHERE pt.agency_id = pa.id AND pt.is_active = true
  );