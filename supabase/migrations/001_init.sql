-- NSEYIN — initial schema. Run in Supabase SQL editor or via `supabase db push`.
-- Design: the public never touches these tables directly. Bookings arrive through an Edge Function using the
-- service-role key. Staff read/write through Supabase Auth + Row Level Security below.


-- ---------- Types ----------
create type booking_status as enum ('new','contacted','confirmed','completed','cancelled','declined','no_show');
create type staff_role as enum ('owner','staff');

-- ---------- Staff ----------
create table staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role staff_role not null default 'staff',
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create function is_staff() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and active)
$$;
create function is_owner() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from staff where user_id = auth.uid() and active and role = 'owner')
$$;

-- ---------- Customers (internal id links bookings; email/phone are attributes, not identity) ----------
create table customers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 1 and 100),
  email text check (email is null or char_length(email) <= 160),
  email_norm text generated always as (lower(btrim(email))) stored,
  phone text check (phone is null or char_length(phone) <= 30),
  phone_norm text generated always as (regexp_replace(coalesce(phone,''), '[^0-9]', '', 'g')) stored,
  preferred_contact text check (preferred_contact in ('email','phone','whatsapp')),
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 4000),
  anonymised_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customers_email_idx on customers (email_norm) where email_norm is not null and email_norm <> '';
create index customers_phone_idx on customers (phone_norm) where phone_norm <> '';

-- ---------- Bookings ----------
create table bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_id uuid not null references customers(id) on delete restrict,
  service text not null check (service in ('deep-tissue','swedish','sports','shiatsu','unsure')),
  preferred_date date not null,
  preferred_time text not null check (preferred_time in ('morning','afternoon','evening','flexible')),
  message text check (message is null or char_length(message) <= 600),
  status booking_status not null default 'new',
  scheduled_at timestamptz,                      -- set by staff when a time is agreed
  idempotency_key uuid unique,
  terms_accepted_at timestamptz not null,
  boundaries_acknowledged_at timestamptz not null,
  terms_version text not null default 'draft-1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index bookings_status_idx on bookings (status, created_at desc);
create index bookings_customer_idx on bookings (customer_id, created_at desc);
create index bookings_sched_idx on bookings (scheduled_at) where scheduled_at is not null;

-- ---------- Append-only history: status changes, contact attempts, notes ----------
create table booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  kind text not null check (kind in ('status_change','contact_attempt','note','created')),
  from_status booking_status,
  to_status booking_status,
  body text check (body is null or char_length(body) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on booking_events (booking_id, created_at);
create index booking_events_customer_idx on booking_events (customer_id, created_at);

-- ---------- Contact form messages ----------
create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 160),
  message text not null check (char_length(message) between 1 and 1500),
  handled boolean not null default false,
  idempotency_key uuid unique,
  created_at timestamptz not null default now()
);

-- ---------- Notification log (only records what the email provider actually reported) ----------
create table notification_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  contact_message_id uuid references contact_messages(id) on delete cascade,
  kind text not null check (kind in ('admin_new_booking','customer_ack','admin_new_contact')),
  status text not null check (status in ('sent','failed','skipped')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

-- ---------- Rate limiting (service role only; keys are salted hashes, never raw IPs) ----------
create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  hits int not null default 0
);
create function rate_limit_hit(p_key text, p_window_seconds int, p_max int) returns boolean
language plpgsql security definer set search_path = public as $$
declare r rate_limits;
begin
  insert into rate_limits(key, window_start, hits) values (p_key, now(), 1)
  on conflict (key) do update set
    hits = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rate_limits.hits + 1 end,
    window_start = case when rate_limits.window_start < now() - make_interval(secs => p_window_seconds) then now() else rate_limits.window_start end
  returning * into r;
  return r.hits <= p_max;
end $$;
revoke all on function rate_limit_hit(text,int,int) from public, anon, authenticated;
grant execute on function rate_limit_hit(text,int,int) to service_role;

-- ---------- Triggers ----------
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger customers_touch before update on customers for each row execute function touch_updated_at();
create trigger bookings_touch before update on bookings for each row execute function touch_updated_at();

-- Record every status change automatically, attributed to the signed-in staff member.
create function log_status_change() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    insert into booking_events(booking_id, customer_id, kind, from_status, to_status, created_by)
    values (new.id, new.customer_id, 'status_change', old.status, new.status, auth.uid());
  end if;
  return new;
end $$;
create trigger bookings_status_log after update on bookings for each row execute function log_status_change();

create function log_booking_created() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into booking_events(booking_id, customer_id, kind, to_status, body)
  values (new.id, new.customer_id, 'created', new.status, 'Request received');
  return new;
end $$;
create trigger bookings_created_log after insert on bookings for each row execute function log_booking_created();

-- ---------- Row Level Security: deny by default, then allow staff ----------
alter table staff enable row level security;
alter table customers enable row level security;
alter table bookings enable row level security;
alter table booking_events enable row level security;
alter table contact_messages enable row level security;
alter table notification_log enable row level security;
alter table rate_limits enable row level security;

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

create policy staff_read_self on staff for select to authenticated using (user_id = auth.uid() or is_owner());
create policy staff_owner_write on staff for all to authenticated using (is_owner()) with check (is_owner());

create policy customers_select on customers for select to authenticated using (is_staff());
create policy customers_insert on customers for insert to authenticated with check (is_staff());
create policy customers_update on customers for update to authenticated using (is_staff()) with check (is_staff());
create policy customers_delete on customers for delete to authenticated using (is_owner());

create policy bookings_select on bookings for select to authenticated using (is_staff());
create policy bookings_insert on bookings for insert to authenticated with check (is_staff());
create policy bookings_update on bookings for update to authenticated using (is_staff()) with check (is_staff());
create policy bookings_delete on bookings for delete to authenticated using (is_owner());

create policy events_select on booking_events for select to authenticated using (is_staff());
create policy events_insert on booking_events for insert to authenticated
  with check (is_staff() and kind in ('contact_attempt','note') and created_by = auth.uid());

create policy contact_select on contact_messages for select to authenticated using (is_staff());
create policy contact_update on contact_messages for update to authenticated using (is_staff()) with check (is_staff());

create policy notif_select on notification_log for select to authenticated using (is_staff());
-- rate_limits: no policies and no grants => no access except the service role.
revoke all on rate_limits from authenticated;

-- ---------- Owner-only operations ----------
-- Anonymise a customer (keeps booking counts/history for the business, removes personal data).
create function anonymise_customer(p_customer uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  update customers set full_name = 'Anonymised customer', email = null, phone = null, preferred_contact = null,
         admin_notes = null, anonymised_at = now() where id = p_customer;
  update bookings set message = null where customer_id = p_customer;
  update booking_events set body = null where customer_id = p_customer and kind in ('note','contact_attempt');
end $$;
revoke all on function anonymise_customer(uuid) from public, anon;
grant execute on function anonymise_customer(uuid) to authenticated;

-- Export for the owner only (the admin UI calls this instead of reading tables directly).
create function export_bookings() returns table (reference text, status booking_status, service text, preferred_date date,
  preferred_time text, scheduled_at timestamptz, created_at timestamptz, full_name text, email text, phone text)
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then raise exception 'owner only' using errcode = '42501'; end if;
  return query select b.reference, b.status, b.service, b.preferred_date, b.preferred_time, b.scheduled_at, b.created_at,
                      c.full_name, c.email, c.phone
               from bookings b join customers c on c.id = b.customer_id order by b.created_at desc;
end $$;
revoke all on function export_bookings() from public, anon;
grant execute on function export_bookings() to authenticated;

-- Staff helper: which role am I?
create function my_role() returns text language sql stable security definer set search_path = public as $$
  select role::text from staff where user_id = auth.uid() and active
$$;
revoke all on function my_role() from public, anon;
grant execute on function my_role() to authenticated;
revoke all on function is_staff(), is_owner() from public, anon;
grant execute on function is_staff(), is_owner() to authenticated;
