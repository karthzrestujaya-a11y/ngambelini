-- NBN pilot: sign-up cap, "commission received" stage, and admin stats.
-- Paste into Supabase > SQL Editor > Run. Safe to run more than once.

-- ===== Settings (sign-up cap) =====
create table if not exists public.app_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
alter table public.app_settings enable row level security;   -- no policies: only the functions below can read/write it
insert into public.app_settings (key, value) values ('signup_cap', '20') on conflict (key) do nothing;

-- Members = everyone except admins
create or replace function public.member_count() returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from auth.users u where not exists (select 1 from profiles p where p.id = u.id and p.is_admin);
$$;
revoke all on function public.member_count() from public;

-- Block new sign-ups once the pilot is full (existing members can still log in)
create or replace function public.enforce_signup_cap() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_cap int;
begin
  select value::int into v_cap from app_settings where key = 'signup_cap';
  if v_cap is not null and public.member_count() >= v_cap then
    raise exception 'pilot_full: NBN pilot is full (% members)', v_cap;
  end if;
  return new;
end $$;
drop trigger if exists on_auth_user_cap on auth.users;
create trigger on_auth_user_cap before insert on auth.users for each row execute function public.enforce_signup_cap();

-- App can show "x of y places taken"
create or replace function public.pilot_status() returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object('members', public.member_count(),
                            'cap', (select value::int from app_settings where key = 'signup_cap'));
$$;
revoke all on function public.pilot_status() from public;
grant execute on function public.pilot_status() to anon, authenticated;

create or replace function public.admin_set_cap(p_cap int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_cap is null or p_cap < 1 or p_cap > 100000 then raise exception 'Cap must be between 1 and 100000'; end if;
  insert into app_settings (key, value, updated_at) values ('signup_cap', p_cap::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  return public.pilot_status();
end $$;
revoke all on function public.admin_set_cap(int) from public;
grant execute on function public.admin_set_cap(int) to authenticated;

-- ===== New stage: commission received from Shopee/Lazada =====
-- waiting -> confirmed (order completed, from the report) -> received (Shopee/Lazada paid us) -> paid (we paid the member)
alter table public.clicks add column if not exists received_at timestamptz;
alter table public.clicks add column if not exists received_ref text;
alter table public.clicks drop constraint if exists clicks_status_chk;
alter table public.clicks add constraint clicks_status_chk check (status in ('waiting','confirmed','received','expired','paid'));

-- admin_set_click: allow undoing a confirmation only while not yet received
create or replace function public.admin_set_click(p_id bigint, p_status text, p_commission numeric default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status = 'confirmed' then
    if coalesce(p_commission, 0) <= 0 then raise exception 'Commission needed'; end if;
    update clicks set status = 'confirmed', confirmed_at = now(), commission_rm = p_commission where id = p_id and status in ('waiting','expired');
  elsif p_status = 'expired' then
    update clicks set status = 'expired' where id = p_id and status = 'waiting';
  elsif p_status = 'waiting' then
    update clicks set status = 'waiting', confirmed_at = null, commission_rm = null where id = p_id and status in ('confirmed','expired');
  else raise exception 'Unknown status %', p_status; end if;
end $$;

-- Totals waiting for Shopee/Lazada to pay us, per platform
create or replace function public.admin_unreceived()
returns table (platform text, orders int, commission_rm numeric, oldest timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select l.platform, count(*)::int, sum(coalesce(c.commission_rm,0)), min(c.confirmed_at)
    from clicks c join listings l on l.id = c.listing_id
   where c.status = 'confirmed'
   group by l.platform order by 1;
end $$;
revoke all on function public.admin_unreceived() from public;
grant execute on function public.admin_unreceived() to authenticated;

-- Shopee/Lazada paid us: mark that platform's confirmed orders (confirmed on/before p_upto) as received
create or replace function public.admin_mark_received(p_platform text, p_ref text, p_upto timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if lower(coalesce(p_platform,'')) not in ('shopee','lazada') then raise exception 'Platform must be shopee or lazada'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'Payment reference needed'; end if;
  update clicks c set status = 'received', received_at = now(), received_ref = trim(p_ref)
    from listings l
   where l.id = c.listing_id and l.platform = lower(p_platform) and c.status = 'confirmed' and c.confirmed_at <= p_upto;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_mark_received(text, text, timestamptz) from public;
grant execute on function public.admin_mark_received(text, text, timestamptz) to authenticated;

-- Who to pay: only money we have actually received (40% to member)
create or replace function public.admin_payouts()
returns table (user_id uuid, email text, orders int, commission_rm numeric, due_rm numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select c.user_id, u.email::text, count(*)::int, sum(coalesce(c.commission_rm,0)), round(sum(coalesce(c.commission_rm,0)) * 0.40, 2)
    from clicks c join auth.users u on u.id = c.user_id
   where c.status = 'received'
   group by c.user_id, u.email
   order by 5 desc;
end $$;

create or replace function public.admin_pay_user(p_user uuid, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'Payment reference needed'; end if;
  update clicks set status = 'paid', paid_at = now(), payout_ref = trim(p_ref) where user_id = p_user and status = 'received';
  get diagnostics n = row_count;
  return n;
end $$;

-- ===== Stats for the admin graphs (Malaysia days, last p_days days) =====
create or replace function public.admin_stats(p_days int default 60) returns jsonb
language plpgsql security definer set search_path = public stable as $$
declare
  d0 date := (now() at time zone 'Asia/Kuala_Lumpur')::date - (greatest(least(p_days, 365), 7) - 1);
  d1 date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  out jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  with days as (select g::date as d from generate_series(d0, d1, interval '1 day') g),
  weeks as (select distinct date_trunc('week', d)::date as w from days),
  mem as (select (p.created_at at time zone 'Asia/Kuala_Lumpur')::date as d from profiles p where not p.is_admin),
  tap as (select (c.clicked_at at time zone 'Asia/Kuala_Lumpur')::date as d, c.id, c.user_id, c.price_rm, c.status, c.confirmed_at, c.commission_rm, coalesce(l.platform, c.platform) as platform, coalesce(pr.category, case when c.search_term is not null then 'Search (not on list)' end) as category
            from clicks c left join listings l on l.id = c.listing_id left join products pr on pr.id = l.product_id
           where not exists (select 1 from profiles a where a.id = c.user_id and a.is_admin)),
  srch as (select (s.created_at at time zone 'Asia/Kuala_Lumpur')::date as d, s.user_id, s.term, s.results
             from searches s where not exists (select 1 from profiles a where a.id = s.user_id and a.is_admin)),
  phot as (select (s.created_at at time zone 'Asia/Kuala_Lumpur')::date as d, s.user_id
             from photo_searches s where not exists (select 1 from profiles a where a.id = s.user_id and a.is_admin)),
  act as (select d, user_id from srch union select d, user_id from phot union select d, user_id from tap)
  select jsonb_build_object(
    'from', d0, 'to', d1,
    'members', public.member_count(),
    'cap', (select value::int from app_settings where key = 'signup_cap'),
    'daily', (select jsonb_agg(jsonb_build_object(
        'd', x.d,
        'joined', (select count(*) from mem where mem.d = x.d),
        'members', (select count(*) from mem where mem.d <= x.d),
        'searches', (select count(*) from srch where srch.d = x.d),
        'photo', (select count(*) from phot where phot.d = x.d),
        'shopee', (select count(*) from tap where tap.d = x.d and tap.platform = 'shopee'),
        'lazada', (select count(*) from tap where tap.d = x.d and tap.platform = 'lazada'),
        'tapped_rm', (select coalesce(sum(price_rm),0) from tap where tap.d = x.d),
        'products', (select count(*) from products p where (p.created_at at time zone 'Asia/Kuala_Lumpur')::date <= x.d),
        'prices', (select count(*) from prices p where (p.checked_at at time zone 'Asia/Kuala_Lumpur')::date <= x.d)
      ) order by x.d) from days x),
    'weekly', (select jsonb_agg(jsonb_build_object(
        'w', k.w,
        'active', (select count(distinct user_id) from act where act.d >= k.w and act.d < k.w + 7 and act.user_id is not null),
        'confirmed', (select count(*) from tap where tap.status in ('confirmed','received','paid') and (tap.confirmed_at at time zone 'Asia/Kuala_Lumpur')::date >= k.w and (tap.confirmed_at at time zone 'Asia/Kuala_Lumpur')::date < k.w + 7),
        'commission_rm', (select coalesce(sum(commission_rm),0) from tap where tap.status in ('confirmed','received','paid') and (tap.confirmed_at at time zone 'Asia/Kuala_Lumpur')::date >= k.w and (tap.confirmed_at at time zone 'Asia/Kuala_Lumpur')::date < k.w + 7)
      ) order by k.w) from weeks k),
    'stages', (select jsonb_object_agg(s, jsonb_build_object('n', n, 'commission_rm', cm)) from (
        select st as s, count(t.id) as n, coalesce(sum(t.commission_rm),0) as cm
          from unnest(array['waiting','confirmed','received','paid','expired']) st left join tap t on t.status = st group by st) z),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'taps', n, 'tapped_rm', rm) order by rm desc), '[]') from (
        select coalesce(category,'Other') as category, count(*) as n, coalesce(sum(price_rm),0) as rm from tap where tap.d >= d0 group by 1) z),
    'not_found', (select coalesce(jsonb_agg(jsonb_build_object('term', term, 'n', n, 'users', u) order by n desc, term), '[]') from (
        select lower(trim(term)) as term, count(*) as n, count(distinct user_id) as u from srch
         where results = 0 and srch.d >= d0 and length(trim(term)) > 1 group by 1 order by 2 desc, 1 limit 15) z),
    'totals', jsonb_build_object(
        'searches', (select count(*) from srch where srch.d >= d0),
        'photo', (select count(*) from phot where phot.d >= d0),
        'taps', (select count(*) from tap where tap.d >= d0),
        'tapped_rm', (select coalesce(sum(price_rm),0) from tap where tap.d >= d0),
        'products_live', (select count(distinct l.product_id) from listings l where l.hidden_reason is null),
        'reports_waiting', (select count(*) from photo_searches where is_listing and price_rm is not null and review = 'new'))
  ) into out;
  return out;
end $$;
revoke all on function public.admin_stats(int) from public;
grant execute on function public.admin_stats(int) to authenticated;

select public.pilot_status() as pilot;
