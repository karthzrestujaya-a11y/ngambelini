-- Admin money jars: NBN's 60% share, waiting (estimated, 4% of listed price) vs confirmed (Shopee-confirmed). Safe to run more than once.
create or replace function public.admin_jars()
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare w numeric; wn int; c numeric; cn int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select coalesce(sum(coalesce(commission_rm, price_rm*0.04)*0.6),0), count(*) into w, wn from clicks where status = 'waiting';
  select coalesce(sum(coalesce(commission_rm,0)*0.6),0), count(*) into c, cn from clicks where status in ('confirmed','received','paid');
  return jsonb_build_object('waiting_rm', w, 'waiting_n', wn, 'confirmed_rm', c, 'confirmed_n', cn);
end $$;
revoke all on function public.admin_jars() from public;
grant execute on function public.admin_jars() to authenticated;
