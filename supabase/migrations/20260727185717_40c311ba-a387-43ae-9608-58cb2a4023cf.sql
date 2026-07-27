CREATE POLICY "train_docs_user_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'train-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "train_docs_user_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'train-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "train_docs_user_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'train-documents' AND (storage.foldername(name))[1] = auth.uid()::text);