-- Snap & Earn (pilot): members snap shop shelf price tags, earn points, paid monthly by the 14th via DuitNow.
-- Rules: 10 pts per approved snap (1,000 pts = RM1) · 30 snaps/day · max RM20/month per member · RM1,000 total budget
-- Payout: balance >= RM5 AND at least 1 Shopee order via NBN that month. Photos kept 30 days (private bucket), price data kept.
-- Safe to run more than once.

-- Settings (on/off, weekly category, budget)
insert into public.app_settings (key, value) values
  ('snap_enabled', 'false'),
  ('snap_category', 'Susu & barang bayi'),
  ('snap_budget_rm', '1000')
on conflict (key) do nothing;

create table if not exists public.snaps (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  category text,
  photo_path text,               -- storage path in bucket 'snaps' (deleted after 30 days)
  photo_hash text,               -- to block the same photo twice
  item text, brand text, pack text, shop text, price_rm numeric(10,2), confidence text,
  status text not null default 'review' check (status in ('approved','review','rejected')),
  reason text,
  points int not null default 0,
  reviewed_at timestamptz,
  payout_id bigint
);
create index if not exists snaps_user_day on public.snaps (user_id, created_at);
create unique index if not exists snaps_hash_uq on public.snaps (photo_hash) where photo_hash is not null;
alter table public.snaps enable row level security;
drop policy if exists snaps_own on public.snaps;
create policy snaps_own on public.snaps for select using (auth.uid() = user_id);

create table if not exists public.snap_payouts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,           -- first day of the month earned
  points int not null,
  amount_rm numeric(10,2) not null,
  duitnow text,
  status text not null default 'due' check (status in ('due','paid')),
  paid_at timestamptz, payout_ref text,
  created_at timestamptz not null default now(),
  unique (user_id, month)
);
alter table public.snap_payouts enable row level security;
drop policy if exists snap_payouts_own on public.snap_payouts;
create policy snap_payouts_own on public.snap_payouts for select using (auth.uid() = user_id);

-- Member's DuitNow ID (phone number) for payouts
alter table public.profiles add column if not exists duitnow text;
create or replace function public.set_duitnow(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v text := regexp_replace(coalesce(p_id,''), '[^0-9]', '', 'g');
begin
  if length(v) < 9 or length(v) > 12 then raise exception 'Enter a valid phone number'; end if;
  update profiles set duitnow = v where id = auth.uid();
  return jsonb_build_object('ok', true, 'duitnow', v);
end $$;
revoke all on function public.set_duitnow(text) from public;
grant execute on function public.set_duitnow(text) to authenticated;

-- Private photo bucket
insert into storage.buckets (id, name, public) values ('snaps', 'snaps', false) on conflict (id) do nothing;

-- Member wallet (what the app shows)
create or replace function public.snap_wallet()
returns jsonb language sql security definer set search_path = public stable as $$
  with m as (select date_trunc('month', now() at time zone 'Asia/Kuala_Lumpur') as m0,
                    date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') as d0)
  select jsonb_build_object(
    'enabled', coalesce((select value from app_settings where key='snap_enabled'),'false') = 'true',
    'category', (select value from app_settings where key='snap_category'),
    'today', (select count(*) from snaps, m where user_id = auth.uid() and (created_at at time zone 'Asia/Kuala_Lumpur') >= m.d0),
    'day_limit', 30,
    'month_points', (select coalesce(sum(points),0) from snaps, m where user_id = auth.uid() and status='approved' and (created_at at time zone 'Asia/Kuala_Lumpur') >= m.m0),
    'unpaid_points', (select coalesce(sum(points),0) from snaps where user_id = auth.uid() and status='approved' and payout_id is null),
    'review', (select count(*) from snaps where user_id = auth.uid() and status='review'),
    'duitnow', (select duitnow from profiles where id = auth.uid()),
    'paid_rm', (select coalesce(sum(amount_rm),0) from snap_payouts where user_id = auth.uid() and status='paid'),
    'recent', (select coalesce(jsonb_agg(r order by r.created_at desc),'[]'::jsonb) from
                 (select id, created_at, item, shop, price_rm, status, points, reason from snaps where user_id = auth.uid() order by created_at desc limit 10) r)
  ) from m;
$$;
revoke all on function public.snap_wallet() from public;
grant execute on function public.snap_wallet() to authenticated;

-- Admin: settings
create or replace function public.admin_snap_settings(p_enabled boolean default null, p_category text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_enabled is not null then update app_settings set value = p_enabled::text, updated_at = now() where key='snap_enabled'; end if;
  if coalesce(trim(p_category),'') <> '' then update app_settings set value = trim(p_category), updated_at = now() where key='snap_category'; end if;
  return jsonb_build_object('enabled', (select value from app_settings where key='snap_enabled'),
    'category', (select value from app_settings where key='snap_category'),
    'spent_rm', (select coalesce(sum(points),0)/1000.0 from snaps where status='approved'),
    'budget_rm', (select value from app_settings where key='snap_budget_rm'));
end $$;
revoke all on function public.admin_snap_settings(boolean, text) from public;
grant execute on function public.admin_snap_settings(boolean, text) to authenticated;

-- Admin: list snaps to review
create or replace function public.admin_snaps(p_status text default 'review')
returns table (id bigint, created_at timestamptz, email text, category text, item text, brand text, pack text, shop text,
               price_rm numeric, confidence text, status text, reason text, photo_path text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select s.id, s.created_at, u.email::text, s.category, s.item, s.brand, s.pack, s.shop, s.price_rm, s.confidence,
                      s.status, s.reason, s.photo_path
    from snaps s left join auth.users u on u.id = s.user_id
   where p_status = 'all' or s.status = p_status order by s.created_at desc limit 200;
end $$;
revoke all on function public.admin_snaps(text) from public;
grant execute on function public.admin_snaps(text) to authenticated;

-- Admin: approve / reject one snap
create or replace function public.admin_review_snap(p_id bigint, p_action text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action = 'approve' then
    update snaps set status='approved', points=10, reason=null, reviewed_at=now() where id=p_id and payout_id is null;
  elsif p_action = 'reject' then
    update snaps set status='rejected', points=0, reason=coalesce(p_reason,'Not clear'), reviewed_at=now() where id=p_id and payout_id is null;
  else raise exception 'Unknown action %', p_action; end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.admin_review_snap(bigint, text, text) from public;
grant execute on function public.admin_review_snap(bigint, text, text) to authenticated;

-- Admin: build the payout list for a month (run after the month ends, pay by the 14th)
-- Eligible: unpaid approved points from that month worth >= RM5 (capped RM20) and >= 1 Shopee order via NBN that month.
create or replace function public.admin_snap_payout_list(p_month date default (date_trunc('month', now() - interval '1 month'))::date)
returns table (payout_id bigint, email text, points int, amount_rm numeric, duitnow text, status text, orders int)
language plpgsql security definer set search_path = public as $$
declare m0 timestamptz := (p_month::timestamp at time zone 'Asia/Kuala_Lumpur'); m1 timestamptz := ((p_month + interval '1 month')::timestamp at time zone 'Asia/Kuala_Lumpur');
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into snap_payouts (user_id, month, points, amount_rm, duitnow)
  select s.user_id, p_month, sum(s.points), least(sum(s.points)/1000.0, 20),
         (select pr.duitnow from profiles pr where pr.id = s.user_id)
    from snaps s
   where s.status='approved' and s.payout_id is null and s.created_at >= m0 and s.created_at < m1
     and exists (select 1 from clicks c where c.user_id = s.user_id and c.clicked_at >= m0 and c.clicked_at < m1 and c.status in ('confirmed','paid'))
   group by s.user_id having sum(s.points) >= 5000
  on conflict (user_id, month) do nothing;
  update snaps s set payout_id = p.id from snap_payouts p
   where p.user_id = s.user_id and p.month = p_month and s.payout_id is null and s.status='approved' and s.created_at >= m0 and s.created_at < m1;
  return query select p.id, u.email::text, p.points, p.amount_rm, p.duitnow, p.status,
    (select count(*)::int from clicks c where c.user_id = p.user_id and c.clicked_at >= m0 and c.clicked_at < m1 and c.status in ('confirmed','paid'))
    from snap_payouts p left join auth.users u on u.id = p.user_id where p.month = p_month order by p.amount_rm desc;
end $$;
revoke all on function public.admin_snap_payout_list(date) from public;
grant execute on function public.admin_snap_payout_list(date) to authenticated;

-- Admin: mark one payout as paid (the app then shows "Dibayar"; the snap function emails the receipt)
create or replace function public.admin_snap_mark_paid(p_id bigint, p_ref text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update snap_payouts set status='paid', paid_at=now(), payout_ref=p_ref where id=p_id and status='due';
  return (select jsonb_build_object('ok', true, 'email', u.email, 'amount_rm', p.amount_rm, 'month', p.month, 'ref', p.payout_ref)
            from snap_payouts p join auth.users u on u.id = p.user_id where p.id = p_id);
end $$;
revoke all on function public.admin_snap_mark_paid(bigint, text) from public;
grant execute on function public.admin_snap_mark_paid(bigint, text) to authenticated;
