-- Admin broadcast notifications. Delivery is materialized server-side so
-- chauffeur accounts never receive general notifications.

CREATE TABLE IF NOT EXISTS public.broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  message text NOT NULL CHECK (length(trim(message)) > 0),
  category text NOT NULL CHECK (category IN ('information', 'promotion', 'alerte', 'evenement', 'mise_a_jour')),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sent_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed'))
);

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS broadcast_id uuid REFERENCES public.broadcast_notifications(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS image_url text;

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_created_at
  ON public.broadcast_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_broadcast
  ON public.user_notifications (broadcast_id);

ALTER TABLE public.broadcast_notifications ENABLE ROW LEVEL SECURITY;

GRANT SELECT, DELETE ON public.broadcast_notifications TO authenticated;
GRANT ALL ON public.broadcast_notifications TO service_role;

DROP POLICY IF EXISTS "broadcast_admin_read" ON public.broadcast_notifications;
CREATE POLICY "broadcast_admin_read" ON public.broadcast_notifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "broadcast_admin_delete" ON public.broadcast_notifications;
CREATE POLICY "broadcast_admin_delete" ON public.broadcast_notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.send_broadcast_notification(
  _title text,
  _message text,
  _category text,
  _image_url text DEFAULT NULL
)
RETURNS public.broadcast_notifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _broadcast public.broadcast_notifications;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Accès administrateur requis';
  END IF;

  IF length(trim(coalesce(_title, ''))) = 0 OR length(trim(coalesce(_message, ''))) = 0 THEN
    RAISE EXCEPTION 'Le titre et le message sont obligatoires';
  END IF;

  IF _category NOT IN ('information', 'promotion', 'alerte', 'evenement', 'mise_a_jour') THEN
    RAISE EXCEPTION 'Catégorie de notification invalide';
  END IF;

  INSERT INTO public.broadcast_notifications (title, message, category, image_url, created_by)
  VALUES (trim(_title), trim(_message), _category, nullif(trim(coalesce(_image_url, '')), ''), auth.uid())
  RETURNING * INTO _broadcast;

  INSERT INTO public.user_notifications (
    user_id, type, title, message, payload, broadcast_id, category, image_url
  )
  SELECT
    u.id,
    'broadcast',
    _broadcast.title,
    _broadcast.message,
    jsonb_build_object('category', _broadcast.category, 'broadcast_id', _broadcast.id),
    _broadcast.id,
    _broadcast.category,
    _broadcast.image_url
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = u.id AND r.role = 'chauffeur'::public.app_role
  );

  RETURN _broadcast;
END;
$$;

REVOKE ALL ON FUNCTION public.send_broadcast_notification(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_broadcast_notification(text, text, text, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'broadcast_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_notifications;
  END IF;
END;
$$;