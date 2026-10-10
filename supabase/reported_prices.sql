-- Reported prices: details the AI reads from user screenshots (never the photo itself).
-- Admin approves or skips each one. Safe to run more than once.
alter table public.photo_searches add column if not exists is_listing boolean not null default false;
alter table public.photo_searches add column if not exists platform text;
alter table public.photo_searches add column if not exists shop text;
alter table public.photo_searches add column if not exists price_rm numeric(10,2);
alter table public.photo_searches add column if not exists price_note text;
alter table public.photo_searches add column if not exists pack text;
alter table public.photo_searches add column if not exists review text not null default 'new';
alter table public.photo_searches add column if not exists reviewed_at timestamptz;
alter table public.photo_searches drop constraint if exists photo_searches_review_chk;
alter table public.photo_searches add constraint photo_searches_review_chk check (review in ('new','approved','skipped'));

-- List reported prices (admin only)
create or replace function public.admin_reported(p_review text default 'new')
returns table (id bigint, query text, platform text, shop text, price_rm numeric, price_note text, pack text,
               confidence text, email text, created_at timestamptz, review text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select s.id, s.query, s.platform, s.shop, s.price_rm, s.price_note, s.pack, s.confidence, u.email::text, s.created_at, s.review
    from photo_searches s left join auth.users u on u.id = s.user_id
   where s.is_listing and s.price_rm is not null and (p_review = 'all' or s.review = p_review)
   order by s.created_at desc limit 200;
end $$;
revoke all on function public.admin_reported(text) from public;
grant execute on function public.admin_reported(text) to authenticated;

-- Approve (adds product + listing + price) or skip one report
create or replace function public.admin_review_report(p_id bigint, p_action text, p_category text default null,
                                                      p_name text default null, p_price numeric default null, p_size text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r photo_searches; v_pid bigint; v_lid bigint; v_url text; v_name text; v_price numeric; v_plat text; v_code text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into r from photo_searches where id = p_id;
  if r.id is null then raise exception 'Report not found'; end if;
  if p_action = 'skip' then
    update photo_searches set review = 'skipped', reviewed_at = now() where id = p_id;
    return jsonb_build_object('ok', true, 'action', 'skipped');
  end if;
  if p_action <> 'approve' then raise exception 'Unknown action %', p_action; end if;
  if coalesce(p_category,'') = '' then raise exception 'Pick a category first'; end if;
  v_plat := lower(coalesce(r.platform,''));
  if v_plat not in ('shopee','lazada') then raise exception 'Only Shopee or Lazada prices can be approved'; end if;
  v_name := coalesce(nullif(trim(p_name),''), r.query);
  v_price := coalesce(p_price, r.price_rm);
  v_code := 'USER-' || p_id;
  v_url := case v_plat when 'shopee' then 'https://shopee.com.my/search?keyword=' else 'https://www.lazada.com.my/catalog/?q=' end
           || replace(v_name, ' ', '%20');

  insert into products (item_code, category, brand, name, pack_size, unit, unit_qty, search_keyword)
  values (v_code, p_category, '', v_name, coalesce(nullif(trim(p_size),''), r.pack), 'piece', 1, lower(v_name))
  on conflict (item_code) do update set category = excluded.category, name = excluded.name, pack_size = excluded.pack_size
  returning id into v_pid;

  select id into v_lid from listings where platform = v_plat and product_url = v_url;
  if v_lid is null then
    insert into listings (product_id, platform, shop_name, title, product_url, pack_qty)
    values (v_pid, v_plat, r.shop, coalesce(nullif(trim(p_size),''), r.pack), v_url, 1) returning id into v_lid;
  end if;
  insert into prices (listing_id, price_rm, checked_at) values (v_lid, v_price, r.created_at);
  update photo_searches set review = 'approved', reviewed_at = now() where id = p_id;
  return jsonb_build_object('ok', true, 'action', 'approved', 'product_id', v_pid);
end $$;
revoke all on function public.admin_review_report(bigint, text, text, text, numeric, text) from public;
grant execute on function public.admin_review_report(bigint, text, text, text, numeric, text) to authenticated;

select count(*) as reports_waiting from public.photo_searches where is_listing and price_rm is not null and review = 'new';
