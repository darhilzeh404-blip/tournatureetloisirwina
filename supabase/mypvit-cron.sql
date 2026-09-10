-- Run after enabling pg_cron / pg_net and creating both Vault secrets.
-- Re-running this script replaces the existing named schedule.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mypvit-reconcile') THEN
    PERFORM cron.unschedule('mypvit-reconcile');
  END IF;
END
$do$;

SELECT cron.schedule(
  'mypvit-reconcile',
  '* * * * *',
  $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mypvit_project_url') || '/functions/v1/mypvit-reconcile',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'mypvit_reconcile_token')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $job$
);
