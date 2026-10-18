import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
const db = new PGlite();
// Minimal Supabase stand-ins: roles, auth schema, auth.uid() driven by a session setting.
await db.exec(`
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth; create table auth.users(id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`);
await db.exec(readFileSync(new URL('../supabase/migrations/001_init.sql', import.meta.url),'utf8'));
// (no extra grants: the migration alone must be safe)
const ids = {};
for (const n of ['owner','staff','outsider']) { const r = await db.query(`insert into auth.users(email) values ($1) returning id`,[n+'@x.com']); ids[n]=r.rows[0].id; }
await db.query(`insert into staff(user_id,role) values ($1,'owner'),($2,'staff')`,[ids.owner,ids.staff]);
async function as(role, sub, sql, params=[]) {
  await db.exec(`reset role; select set_config('request.jwt.sub','${sub||''}',false); set role ${role};`);
  try { const r = await db.query(sql, params); return { ok:true, rows:r.rows, n:r.affectedRows ?? r.rows.length }; }
  catch(e){ return { ok:false, err:e.message }; }
  finally { await db.exec('reset role'); }
}
let pass=0, fail=0; const t=(name,cond,extra='')=>{ (cond?pass++:fail++); console.log((cond?'PASS ':'FAIL ')+name+(cond?'':'  '+extra)); };
// service role creates a booking (what the Edge Function does)
const c = await as('service_role',null,`insert into customers(full_name,email,phone,preferred_contact) values ('Ada Obi','Ada@Example.com','+234 801 234 5678','email') returning id`);
const cid = c.rows[0].id;
t('generated email_norm lowercases', (await as('service_role',null,`select email_norm,phone_norm from customers`)).rows[0].email_norm==='ada@example.com');
t('phone_norm digits only', (await as('service_role',null,`select phone_norm from customers`)).rows[0].phone_norm==='2348012345678');
const b = await as('service_role',null,`insert into bookings(reference,customer_id,service,preferred_date,preferred_time,terms_accepted_at,boundaries_acknowledged_at,idempotency_key) values ('NSY-AAAAAA',$1,'swedish',current_date+3,'evening',now(),now(),gen_random_uuid()) returning id`,[cid]);
const bid = b.rows[0].id;
t('created event logged by trigger', (await as('service_role',null,`select count(*)::int n from booking_events where kind='created'`)).rows[0].n===1);
// anon: nothing
for (const tbl of ['customers','bookings','booking_events','contact_messages','notification_log','staff','rate_limits']) {
  const r = await as('anon',null,`select * from ${tbl}`); t(`anon cannot read ${tbl}`, !r.ok);
}
t('anon cannot insert booking', !(await as('anon',null,`insert into customers(full_name) values ('x')`)).ok);
// signed-in non-staff: sees zero rows, cannot write
for (const tbl of ['customers','bookings','booking_events']) { const r = await as('authenticated',ids.outsider,`select * from ${tbl}`); t(`non-staff user sees 0 rows in ${tbl}`, r.ok && r.rows.length===0); }
t('non-staff cannot insert customer', !(await as('authenticated',ids.outsider,`insert into customers(full_name) values ('x')`)).ok);
t('non-staff cannot read rate_limits', !(await as('authenticated',ids.outsider,`select * from rate_limits`)).ok);
t('authenticated cannot call rate_limit_hit', !(await as('authenticated',ids.staff,`select rate_limit_hit('k',60,5)`)).ok);
// staff
t('staff reads customers', (await as('authenticated',ids.staff,`select * from customers`)).rows.length===1);
t('staff reads bookings', (await as('authenticated',ids.staff,`select * from bookings`)).rows.length===1);
const up = await as('authenticated',ids.staff,`update bookings set status='contacted' where id=$1 returning status`,[bid]);
t('staff updates status', up.ok && up.rows[0].status==='contacted');
const ev = await as('authenticated',ids.staff,`select kind,from_status,to_status,created_by from booking_events where kind='status_change'`);
t('status change auto-logged with staff id', ev.rows.length===1 && ev.rows[0].created_by===ids.staff && ev.rows[0].to_status==='contacted');
t('staff adds contact attempt', (await as('authenticated',ids.staff,`insert into booking_events(booking_id,customer_id,kind,body,created_by) values ($1,$2,'contact_attempt','Called, no answer',$3)`,[bid,cid,ids.staff])).ok);
t('staff cannot forge status_change event', !(await as('authenticated',ids.staff,`insert into booking_events(booking_id,customer_id,kind,created_by) values ($1,$2,'status_change',$3)`,[bid,cid,ids.staff])).ok);
t('staff cannot attribute note to someone else', !(await as('authenticated',ids.staff,`insert into booking_events(booking_id,customer_id,kind,body,created_by) values ($1,$2,'note','x',$3)`,[bid,cid,ids.owner])).ok);
t('events are append-only (no update)', (await as('authenticated',ids.staff,`update booking_events set body='tampered'`)).n===0);
t('events are append-only (no delete)', (await as('authenticated',ids.staff,`delete from booking_events`)).n===0);
t('staff cannot delete customer', (await as('authenticated',ids.staff,`delete from customers`)).n===0);
t('staff cannot delete booking', (await as('authenticated',ids.staff,`delete from bookings`)).n===0);
t('staff cannot export', !(await as('authenticated',ids.staff,`select * from export_bookings()`)).ok);
t('staff cannot anonymise', !(await as('authenticated',ids.staff,`select anonymise_customer($1)`,[cid])).ok);
t('staff cannot make themselves owner', (await as('authenticated',ids.staff,`update staff set role='owner' where user_id=$1`,[ids.staff])).n===0);
t('staff cannot add staff', !(await as('authenticated',ids.staff,`insert into staff(user_id,role) values ($1,'owner')`,[ids.outsider])).ok);
t('my_role works', (await as('authenticated',ids.staff,`select my_role() r`)).rows[0].r==='staff');
// owner
t('owner exports', (await as('authenticated',ids.owner,`select * from export_bookings()`)).rows.length===1);
t('owner anonymises', (await as('authenticated',ids.owner,`select anonymise_customer($1)`,[cid])).ok);
const an = (await as('service_role',null,`select full_name,email,phone,anonymised_at from customers`)).rows[0];
t('anonymised data removed', an.email===null && an.phone===null && an.anonymised_at && an.full_name==='Anonymised customer');
t('contact notes wiped', (await as('service_role',null,`select body from booking_events where kind='contact_attempt'`)).rows[0].body===null);
// deactivated staff
await db.query(`update staff set active=false where user_id=$1`,[ids.staff]);
t('deactivated staff loses access', (await as('authenticated',ids.staff,`select * from customers`)).rows.length===0);
// rate limit + constraints + idempotency
const hits=[]; for (let i=0;i<7;i++) hits.push((await as('service_role',null,`select rate_limit_hit('ip:abc',3600,5) ok`)).rows[0].ok);
t('rate limit allows 5 then blocks', JSON.stringify(hits)==='[true,true,true,true,true,false,false]', JSON.stringify(hits));
t('invalid service rejected', !(await as('service_role',null,`insert into bookings(reference,customer_id,service,preferred_date,preferred_time,terms_accepted_at,boundaries_acknowledged_at) values ('NSY-BBBBBB',$1,'hot-stone',current_date,'evening',now(),now())`,[cid])).ok);
const key='11111111-1111-1111-1111-111111111111';
await as('service_role',null,`insert into bookings(reference,customer_id,service,preferred_date,preferred_time,terms_accepted_at,boundaries_acknowledged_at,idempotency_key) values ('NSY-CCCCCC',$1,'sports',current_date,'morning',now(),now(),$2)`,[cid,key]);
t('duplicate idempotency key rejected by DB', !(await as('service_role',null,`insert into bookings(reference,customer_id,service,preferred_date,preferred_time,terms_accepted_at,boundaries_acknowledged_at,idempotency_key) values ('NSY-DDDDDD',$1,'sports',current_date,'morning',now(),now(),$2)`,[cid,key])).ok);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail?1:0);
