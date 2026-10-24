-- NBN: Involve orders pulled by the involve-sync function (every 6 hours). One row per Involve conversion.
create table if not exists public.involve_conversions (
  conversion_id text primary key,
  offer_name text,
  aff_sub text, aff_sub2 text, aff_sub3 text, aff_sub4 text, aff_sub5 text,
  sale_amount numeric(12,2),
  commission_rm numeric(12,2),
  involve_status text,
  converted_at timestamptz,
  user_id uuid,
  click_id bigint,
  raw jsonb,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.involve_conversions enable row level security;
-- no policies: only the edge function (service role) and admin RPCs read it
create table if not exists public.involve_sync_state (id int primary key default 1, last_run timestamptz, last_result jsonb);
alter table public.involve_sync_state enable row level security;
insert into public.involve_sync_state(id) values (1) on conflict do nothing;

-- Admin view: Involve orders by post label (aff_sub) and shop
create or replace function public.admin_involve_orders(p_days int default 60)
returns table (converted_at timestamptz, offer_name text, aff_sub text, aff_sub2 text, sale_amount numeric, commission_rm numeric, involve_status text, email text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select c.converted_at, c.offer_name, c.aff_sub, c.aff_sub2, c.sale_amount, c.commission_rm, c.involve_status, u.email::text
    from involve_conversions c left join auth.users u on u.id = c.user_id
   where c.converted_at >= now() - make_interval(days => p_days)
   order by c.converted_at desc limit 500;
end $$;
revoke all on function public.admin_involve_orders(int) from public;
grant execute on function public.admin_involve_orders(int) to authenticated;

-- helper: member id (first 12 hex characters of the user id, as used in every link) -> user id. Service role only.
create or replace function public.involve_user_by_sub(p_sub text) returns uuid
language sql security definer set search_path = public stable as $$
  select id from auth.users where left(replace(id::text,'-',''),12) = lower(p_sub) limit 1;
$$;
revoke all on function public.involve_user_by_sub(text) from public, anon, authenticated;
grant execute on function public.involve_user_by_sub(text) to service_role;
