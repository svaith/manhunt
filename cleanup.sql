-- Enable Supabase's pg_cron extension first (Database > Extensions).
-- Run once. Removes abandoned/expired rooms, including their location data,
-- even when nobody reopens the site. At most 5 minutes after 12-hour expiry.
select cron.schedule(
  'manhunt-expired-room-cleanup', '*/5 * * * *',
  $$delete from public.manhunt_rooms where expires_at < now()$$
);
