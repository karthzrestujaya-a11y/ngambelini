-- NBN pilot prep: price-sheet upload + cash-back admin.
-- Paste into Supabase > SQL Editor > New query > Run. Safe to run more than once.

-- ===== Admin flag =====
alter table public.profiles add column if not exists is_admin boolean not null default false;
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
update public.profiles set is_admin = true
 where email in ('kaarthigeyen.ramachandren85@gmail.com', 'karthz.restujaya@gmail.com');

-- ===== Price sheet columns =====
alter table public.products add column if not exists item_code text;
create unique index if not exists products_item_code_key on public.products (item_code);
alter table public.listings add column if not exists pack_qty numeric;

-- ===== Cash-back columns (already added on 9 Oct; repeated so this file stands alone) =====
alter table public.clicks add column if not exists status text not null default 'waiting';
alter table public.clicks add column if not exists confirmed_at timestamptz;
alter table public.clicks add column if not exists commission_rm numeric(10,2);
alter table public.clicks add column if not exists paid_at timestamptz;
alter table public.clicks add column if not exists payout_ref text;
alter table public.clicks drop constraint if exists clicks_status_chk;
alter table public.clicks add constraint clicks_status_chk check (status in ('waiting','confirmed','expired','paid'));

-- ===== Upload the price sheet (admin only) =====
-- p_rows: [{item_id, category, brand, name, size, unit, keywords,
--           shopee_price, shopee_link, shopee_stock, lazada_price, lazada_link, lazada_stock, checked}]
create or replace function public.admin_import_prices(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r jsonb; plat text; v_pid bigint; v_lid bigint;
  v_unit text; v_qty numeric; v_size numeric; v_price numeric; v_link text; v_stock text; v_day timestamptz;
  n_prod int := 0; n_price int := 0; n_skip int := 0; priced_products int := 0; got_price boolean;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    if coalesce(r->>'item_id','') = '' or coalesce(r->>'name','') = '' then n_skip := n_skip + 1; continue; end if;
    v_size := nullif(r->>'size','')::numeric;
    v_unit := case lower(coalesce(r->>'unit','')) when 'g' then 'kg' when 'kg' then 'kg'
                when 'ml' then 'l' when 'l' then 'l' else 'piece' end;
    v_qty := case lower(coalesce(r->>'unit','')) when 'g' then v_size/1000 when 'ml' then v_size/1000 else v_size end;
    v_day := coalesce(nullif(r->>'checked','')::date::timestamp at time zone 'Asia/Kuala_Lumpur' + interval '9 hours', now());

    insert into products (item_code, category, brand, name, pack_size, unit, unit_qty, search_keyword)
    values (upper(r->>'item_id'), r->>'category', r->>'brand', r->>'name',
            trim(both from coalesce(r->>'size','') || coalesce(r->>'unit','')), v_unit, v_qty,
            lower(coalesce(r->>'brand','') || ' ' || coalesce(r->>'keywords','')))
    on conflict (item_code) do update set category = excluded.category, brand = excluded.brand, name = excluded.name,
      pack_size = excluded.pack_size, unit = excluded.unit, unit_qty = excluded.unit_qty, search_keyword = excluded.search_keyword
    returning id into v_pid;
    n_prod := n_prod + 1; got_price := false;

    foreach plat in array array['shopee','lazada'] loop
      v_price := nullif(r->>(plat || '_price'),'')::numeric;
      v_link  := nullif(trim(coalesce(r->>(plat || '_link'),'')),'');
      v_stock := upper(coalesce(r->>(plat || '_stock'),'Y'));
      if v_link is null then continue; end if;
      -- same link already known? reuse it; otherwise reuse this product's listing on that platform
      select id into v_lid from listings where platform = plat and product_url = v_link;
      if v_lid is null then
        select id into v_lid from listings where product_id = v_pid and platform = plat order by id desc limit 1;
      end if;
      if v_lid is null then
        insert into listings (product_id, platform, shop_name, title, product_url, pack_qty)
        values (v_pid, plat, null, null, v_link, v_qty) returning id into v_lid;
      else
        update listings set product_id = v_pid, product_url = v_link, pack_qty = v_qty,
          hidden_reason = case when v_stock = 'N' then 'out of stock' else null end
         where id = v_lid;
      end if;
      if v_stock = 'N' then update listings set hidden_reason = 'out of stock' where id = v_lid; end if;
      if v_price is not null and v_stock <> 'N' then
        delete from prices where listing_id = v_lid and (checked_at at time zone 'Asia/Kuala_Lumpur')::date = (v_day at time zone 'Asia/Kuala_Lumpur')::date;
        insert into prices (listing_id, price_rm, checked_at) values (v_lid, v_price, v_day);
        n_price := n_price + 1; got_price := true;
      end if;
      v_lid := null;
    end loop;
    if got_price then priced_products := priced_products + 1; end if;
  end loop;

  -- once the sheet is the real list (20+ priced products), retire the old hand-typed test products
  if priced_products >= 20 then
    update listings set hidden_reason = 'replaced by price sheet'
     where hidden_reason is null and product_id in (select id from products where item_code is null);
  end if;
  return jsonb_build_object('products', n_prod, 'prices', n_price, 'skipped', n_skip, 'priced_products', priced_products);
end $$;
revoke all on function public.admin_import_prices(jsonb) from public;
grant execute on function public.admin_import_prices(jsonb) to authenticated;

-- ===== Cash back: list taps (admin only) =====
create or replace function public.admin_clicks(p_status text default 'waiting')
returns table (id bigint, email text, sub_id text, product text, platform text, price_rm numeric, saving_rm numeric,
               commission_rm numeric, status text, clicked_at timestamptz, confirmed_at timestamptz, paid_at timestamptz, payout_ref text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select c.id, u.email::text, left(replace(c.user_id::text,'-',''),12), p.name || coalesce(' ' || p.pack_size,''), l.platform,
         c.price_rm, c.saving_rm, c.commission_rm, c.status, c.clicked_at, c.confirmed_at, c.paid_at, c.payout_ref
    from clicks c
    left join auth.users u on u.id = c.user_id
    left join listings l on l.id = c.listing_id
    left join products p on p.id = l.product_id
   where p_status = 'all' or c.status = p_status
   order by c.clicked_at desc
   limit 300;
end $$;
revoke all on function public.admin_clicks(text) from public;
grant execute on function public.admin_clicks(text) to authenticated;

-- Confirm (with the commission from the Shopee/Lazada report) or expire one tap
create or replace function public.admin_set_click(p_id bigint, p_status text, p_commission numeric default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status = 'confirmed' then
    update clicks set status = 'confirmed', confirmed_at = now(), commission_rm = p_commission where id = p_id and status in ('waiting','expired');
  elsif p_status = 'expired' then
    update clicks set status = 'expired' where id = p_id and status = 'waiting';
  elsif p_status = 'waiting' then
    update clicks set status = 'waiting', confirmed_at = null, commission_rm = null where id = p_id and status in ('confirmed','expired');
  else raise exception 'Unknown status %', p_status; end if;
end $$;
revoke all on function public.admin_set_click(bigint, text, numeric) from public;
grant execute on function public.admin_set_click(bigint, text, numeric) to authenticated;

-- Who to pay: confirmed, unpaid cash back per member (customer share 40%)
create or replace function public.admin_payouts()
returns table (user_id uuid, email text, orders int, commission_rm numeric, due_rm numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select c.user_id, u.email::text, count(*)::int, sum(coalesce(c.commission_rm,0)), round(sum(coalesce(c.commission_rm,0)) * 0.40, 2)
    from clicks c join auth.users u on u.id = c.user_id
   where c.status = 'confirmed'
   group by c.user_id, u.email
   order by 5 desc;
end $$;
revoke all on function public.admin_payouts() from public;
grant execute on function public.admin_payouts() to authenticated;

-- Mark everything confirmed for a member as paid (after the DuitNow transfer)
create or replace function public.admin_pay_user(p_user uuid, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'Payment reference needed'; end if;
  update clicks set status = 'paid', paid_at = now(), payout_ref = trim(p_ref) where user_id = p_user and status = 'confirmed';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_pay_user(uuid, text) from public;
grant execute on function public.admin_pay_user(uuid, text) to authenticated;

-- Profile read must include is_admin for the app to show the Admin button
select email, is_admin from public.profiles where is_admin;
