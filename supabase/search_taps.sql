-- Record taps on "Search on Shopee / Lazada" buttons (no product listing), so orders can be matched to members.
-- Safe to run more than once. Run AFTER pilot_stats.sql.
alter table public.clicks add column if not exists platform text;
alter table public.clicks add column if not exists search_term text;

create or replace function public.admin_clicks(p_status text default 'waiting')
returns table (id bigint, email text, sub_id text, product text, platform text, price_rm numeric, saving_rm numeric,
               commission_rm numeric, status text, clicked_at timestamptz, confirmed_at timestamptz, paid_at timestamptz, payout_ref text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select c.id, u.email::text, left(replace(c.user_id::text,'-',''),12),
         coalesce(p.name || coalesce(' ' || p.pack_size,''), 'Search: ' || c.search_term, '?'),
         coalesce(l.platform, c.platform),
         c.price_rm, c.saving_rm, c.commission_rm, c.status, c.clicked_at, c.confirmed_at, c.paid_at, c.payout_ref
    from clicks c
    left join auth.users u on u.id = c.user_id
    left join listings l on l.id = c.listing_id
    left join products p on p.id = l.product_id
   where p_status = 'all' or c.status = p_status
   order by c.clicked_at desc
   limit 300;
end $$;

create or replace function public.admin_unreceived()
returns table (platform text, orders int, commission_rm numeric, oldest timestamptz)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select coalesce(l.platform, c.platform), count(*)::int, sum(coalesce(c.commission_rm,0)), min(c.confirmed_at)
    from clicks c left join listings l on l.id = c.listing_id
   where c.status = 'confirmed'
   group by 1 order by 1;
end $$;

create or replace function public.admin_mark_received(p_platform text, p_ref text, p_upto timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if lower(coalesce(p_platform,'')) not in ('shopee','lazada') then raise exception 'Platform must be shopee or lazada'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'Payment reference needed'; end if;
  update clicks c set status = 'received', received_at = now(), received_ref = trim(p_ref)
   where c.status = 'confirmed' and c.confirmed_at <= p_upto
     and coalesce((select l.platform from listings l where l.id = c.listing_id), c.platform) = lower(p_platform);
  get diagnostics n = row_count;
  return n;
end $$;

select count(*) as search_taps from public.clicks where listing_id is null;
