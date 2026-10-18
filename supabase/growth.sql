-- NBN growth tracking for admins: online now, users today, sign-ups, targets, photo-search load, Shopee taps, 7-day chart.
-- Safe to run more than once.

alter table public.profiles add column if not exists last_seen timestamptz;
create index if not exists profiles_last_seen on public.profiles (last_seen);

-- App calls this on open and every few minutes while open
create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update profiles set last_seen = now() where id = auth.uid();
$$;
revoke all on function public.touch_seen() from public;
grant execute on function public.touch_seen() to authenticated;

insert into public.app_settings (key, value) values
  ('target_1', '2000'), ('target_2', '10000'), ('target_2_date', '2026-12-31'), ('ai_daily_limit', '1000')
on conflict (key) do nothing;

create or replace function public.admin_growth()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare d0 timestamptz := date_trunc('day', now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur';
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'online_now', (select count(*) from profiles where last_seen > now() - interval '15 minutes' and not (is_admin or is_test)),
    'users_today', (select count(*) from profiles where last_seen >= d0 and not (is_admin or is_test)),
    'signups_today', (select count(*) from auth.users u where u.created_at >= d0 and not exists (select 1 from profiles p where p.id=u.id and (p.is_admin or p.is_test))),
    'members', public.member_count(),
    'cap', (select value::int from app_settings where key='signup_cap'),
    'target_1', (select value::int from app_settings where key='target_1'),
    'target_2', (select value::int from app_settings where key='target_2'),
    'target_2_date', (select value from app_settings where key='target_2_date'),
    'ai_limit', (select value::int from app_settings where key='ai_daily_limit'),
    'photos_today', (select count(*) from photo_searches ps where created_at >= d0 and not exists (select 1 from profiles pa where pa.id = ps.user_id and (pa.is_admin or pa.is_test))),
    'snaps_today', (select count(*) from snaps sn where created_at >= d0 and not exists (select 1 from profiles pa where pa.id = sn.user_id and (pa.is_admin or pa.is_test))),
    'taps_today', (select count(*) from clicks ck where clicked_at >= d0 and not exists (select 1 from profiles pa where pa.id = ck.user_id and (pa.is_admin or pa.is_test))),
    'days', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
        select g.day::date as day,
          (select count(*) from auth.users u where (u.created_at at time zone 'Asia/Kuala_Lumpur')::date = g.day::date and not exists (select 1 from profiles pa where pa.id = u.id and (pa.is_admin or pa.is_test))) as signups,
          (select count(*) from photo_searches s where (s.created_at at time zone 'Asia/Kuala_Lumpur')::date = g.day::date and not exists (select 1 from profiles pa where pa.id = s.user_id and (pa.is_admin or pa.is_test))) as photos,
          (select count(*) from clicks c where (c.clicked_at at time zone 'Asia/Kuala_Lumpur')::date = g.day::date and not exists (select 1 from profiles pa where pa.id = c.user_id and (pa.is_admin or pa.is_test))) as taps
        from generate_series((now() at time zone 'Asia/Kuala_Lumpur')::date - 6, (now() at time zone 'Asia/Kuala_Lumpur')::date, interval '1 day') g(day)) x)
  );
end $$;
revoke all on function public.admin_growth() from public;
grant execute on function public.admin_growth() to authenticated;

-- Open the pilot for the blast: room for the first target
update public.app_settings set value = '2000', updated_at = now() where key = 'signup_cap' and value::int < 2000;

-- Earnings by day (last 30 days): commission confirmed from Shopee reports, NBN's 60% share, and money actually received
create or replace function public.admin_earnings()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare t date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'month_commission', (select coalesce(sum(commission_rm),0) from clicks where confirmed_at >= date_trunc('month', t)::timestamp at time zone 'Asia/Kuala_Lumpur'),
    'month_received', (select coalesce(sum(commission_rm),0) from clicks where received_at >= date_trunc('month', t)::timestamp at time zone 'Asia/Kuala_Lumpur'),
    'pending', (select coalesce(sum(commission_rm),0) from clicks where status = 'confirmed'),
    'total_received', (select coalesce(sum(commission_rm),0) from clicks where status in ('received','paid')),
    'snap_cost', (select coalesce(sum(points),0)/1000.0 from snaps where status = 'approved'),
    'days', (select coalesce(jsonb_agg(x order by x.day), '[]'::jsonb) from (
       select g.day::date as day,
         (select coalesce(sum(commission_rm),0) from clicks c where (c.confirmed_at at time zone 'Asia/Kuala_Lumpur')::date = g.day::date) as commission,
         (select coalesce(sum(commission_rm),0) from clicks c where (c.received_at at time zone 'Asia/Kuala_Lumpur')::date = g.day::date) as received
       from generate_series(t - 29, t, interval '1 day') g(day)) x));
end $$;
revoke all on function public.admin_earnings() from public;
grant execute on function public.admin_earnings() to authenticated;
