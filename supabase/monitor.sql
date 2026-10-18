-- NBN monitoring: Facebook/TikTok numbers (entered daily) + money pipeline with expected pay dates.
-- Safe to run more than once.

create table if not exists public.social_daily (
  day date primary key,
  fb_followers int, fb_views int,
  tt_followers int, tt_views int,
  updated_at timestamptz not null default now()
);
alter table public.social_daily enable row level security;

insert into public.app_settings (key, value) values ('shopee_pay_days', '45')
on conflict (key) do nothing;

-- Save today's (or a given day's) social numbers. Nulls keep what is already there.
create or replace function public.admin_social_set(p_day date, p_fb_followers int, p_fb_views int, p_tt_followers int, p_tt_views int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into social_daily (day, fb_followers, fb_views, tt_followers, tt_views)
  values (coalesce(p_day, (now() at time zone 'Asia/Kuala_Lumpur')::date), p_fb_followers, p_fb_views, p_tt_followers, p_tt_views)
  on conflict (day) do update set
    fb_followers = coalesce(excluded.fb_followers, social_daily.fb_followers),
    fb_views     = coalesce(excluded.fb_views, social_daily.fb_views),
    tt_followers = coalesce(excluded.tt_followers, social_daily.tt_followers),
    tt_views     = coalesce(excluded.tt_views, social_daily.tt_views),
    updated_at = now();
end $$;
revoke all on function public.admin_social_set(date,int,int,int,int) from public;
grant execute on function public.admin_social_set(date,int,int,int,int) to authenticated;

-- Last 14 days of social numbers + money pipeline
create or replace function public.admin_monitor()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare pd int := coalesce((select value::int from app_settings where key = 'shopee_pay_days'), 45);
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'social', (select coalesce(jsonb_agg(s order by s.day), '[]'::jsonb) from (
        select day, fb_followers, fb_views, tt_followers, tt_views from social_daily
        where day >= (now() at time zone 'Asia/Kuala_Lumpur')::date - 13) s),
    'pay_days', pd,
    'taps_total',   (select count(*) from clicks),
    'waiting_n',    (select count(*) from clicks where status = 'waiting'),
    'confirmed_n',  (select count(*) from clicks where status = 'confirmed'),
    'confirmed_rm', (select coalesce(sum(commission_rm),0) from clicks where status = 'confirmed'),
    'received_rm',  (select coalesce(sum(commission_rm),0) from clicks where status in ('received','paid')),
    'owed_members_rm', (select coalesce(sum(commission_rm),0) * 0.4 from clicks where status = 'received'),
    'paid_members_rm', (select coalesce(sum(commission_rm),0) * 0.4 from clicks where status = 'paid'),
    'batches', (select coalesce(jsonb_agg(b order by b.month), '[]'::jsonb) from (
        select date_trunc('month', confirmed_at at time zone 'Asia/Kuala_Lumpur')::date as month,
               count(*) as n, sum(commission_rm) as rm,
               (max(confirmed_at) at time zone 'Asia/Kuala_Lumpur')::date + pd as expected
        from clicks where status = 'confirmed' and confirmed_at is not null
        group by 1) b)
  );
end $$;
revoke all on function public.admin_monitor() from public;
grant execute on function public.admin_monitor() to authenticated;
