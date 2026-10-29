-- Leave test accounts out of admin_stats (members, taps, searches, photos). Safe to run more than once.
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
  mem as (select (p.created_at at time zone 'Asia/Kuala_Lumpur')::date as d from profiles p where not (p.is_admin or p.is_test)),
  tap as (select (c.clicked_at at time zone 'Asia/Kuala_Lumpur')::date as d, c.id, c.user_id, c.price_rm, c.status, c.confirmed_at, c.commission_rm, coalesce(l.platform, c.platform) as platform, coalesce(pr.category, case when c.search_term is not null then 'Search (not on list)' end) as category
            from clicks c left join listings l on l.id = c.listing_id left join products pr on pr.id = l.product_id
           where not exists (select 1 from profiles a where a.id = c.user_id and (a.is_admin or a.is_test))),
  srch as (select (s.created_at at time zone 'Asia/Kuala_Lumpur')::date as d, s.user_id, s.term, s.results
             from searches s where not exists (select 1 from profiles a where a.id = s.user_id and (a.is_admin or a.is_test))),
  phot as (select (s.created_at at time zone 'Asia/Kuala_Lumpur')::date as d, s.user_id
             from photo_searches s where not exists (select 1 from profiles a where a.id = s.user_id and (a.is_admin or a.is_test))),
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
