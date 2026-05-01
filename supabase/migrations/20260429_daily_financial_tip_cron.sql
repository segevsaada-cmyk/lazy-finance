-- Lazy Finance — Daily Financial Tip cron job
-- Runs every morning at 06:00 UTC = 09:00 IL summer / 08:00 IL winter
-- Calls the send-daily-financial-tip edge function

-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Drop existing job if re-running
select cron.unschedule('lazy-finance-daily-tip')
where exists (select 1 from cron.job where jobname = 'lazy-finance-daily-tip');

-- Schedule daily at 06:00 UTC (08-09 IL)
select cron.schedule(
  'lazy-finance-daily-tip',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://jamltyybiemjpmbmvobt.supabase.co/functions/v1/send-daily-financial-tip',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
