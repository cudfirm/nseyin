-- NSEYIN 002: session length and where the session happens.
-- Safe to run once on top of 001_init.sql. Old bookings keep these two fields empty.
alter table bookings
  add column if not exists duration text check (duration is null or duration in ('30','60','custom')),
  add column if not exists session_location text check (session_location is null or session_location in ('workspace','home','suite'));

-- The CSV export gains the two new columns (a function's output shape cannot be changed in place).
drop function if exists export_bookings();
create function export_bookings() returns table (reference text, status booking_status, service text, duration text, session_location text,
  preferred_date date, preferred_time text, scheduled_at timestamptz, created_at timestamptz, full_name text, email text, phone text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return query select b.reference, b.status, b.service, b.duration, b.session_location, b.preferred_date, b.preferred_time, b.scheduled_at, b.created_at,
                      c.full_name, c.email, c.phone
               from bookings b join customers c on c.id = b.customer_id order by b.created_at desc;
end $$;
revoke all on function export_bookings() from public, anon;
grant execute on function export_bookings() to authenticated;
