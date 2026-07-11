-- Combler l'écart d'audit RLS storage : le rôle 'agence' peut déjà uploader
-- et mettre à jour ses images dans 'ticket-images' (logos, billets), mais ne
-- peut pas les supprimer. On aligne DELETE sur INSERT/UPDATE pour éviter les
-- fichiers orphelins lors du remplacement d'un logo. Aucun assouplissement
-- pour anon ou pour d'autres buckets.
DROP POLICY IF EXISTS "Staff delete ticket-images" ON storage.objects;

CREATE POLICY "Staff delete ticket-images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-images'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'gerant'::app_role)
      OR has_role(auth.uid(), 'agence'::app_role)
    )
  );