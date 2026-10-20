-- NSEYIN 003: automatic clean-up of old personal data (retention).
-- Rules (change the numbers in purge_old_records() if you change your policy):
--   * Contact-form messages ............................. deleted after 30 days
--   * Booking requests that never became a session
--     (status new / contacted / declined) ............... deleted after 30 days
--   * Sessions (confirmed / completed / cancelled / no-show) deleted 12 months after the session date
--   * Customers who have no bookings left (and are older than 30 days) are deleted
--   * Anti-spam counters older than 2 days are deleted
-- "Deleted" means removed from the database. Their history rows and email-log rows go with them.

create or replace function purge_old_records() returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_msg int; n_req int; n_ses int; n_cus int; n_rl int;
begin
  delete from contact_messages where created_at < now() - interval '30 days';
  get diagnostics n_msg = row_count;

  delete from bookings where status in ('new','contacted','declined') and created_at < now() - interval '30 days';
  get diagnostics n_req = row_count;

  delete from bookings where status in ('confirmed','completed','cancelled','no_show')
    and coalesce(scheduled_at::date, preferred_date) < (current_date - interval '12 months')::date;
  get diagnostics n_ses = row_count;

  delete from customers c where c.created_at < now() - interval '30 days'
    and not exists (select 1 from bookings b where b.customer_id = c.id);
  get diagnostics n_cus = row_count;

  delete from rate_limits where window_start < now() - interval '2 days';
  get diagnostics n_rl = row_count;

  return jsonb_build_object('contact_messages', n_msg, 'requests', n_req, 'old_sessions', n_ses, 'customers', n_cus, 'rate_limits', n_rl);
end $$;
revoke all on function purge_old_records() from public, anon, authenticated;
grant execute on function purge_old_records() to service_role;

-- Run it every day at 03:15 (UTC) if the pg_cron extension is switched on
-- (Dashboard > Database > Extensions > pg_cron). If it is not on yet, this only prints a notice.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('nseyin-daily-cleanup', '15 3 * * *', 'select purge_old_records()');
  else
    raise notice 'pg_cron is not enabled: switch it on in Database > Extensions, then run this file again.';
  end if;
end $$;
