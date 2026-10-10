-- Links members paste into search (Shopee / Lazada "Share > Copy link").
-- Admin turns them into app items; Lazada ones get the affiliate link from the Lazada Link Convertor.
-- Safe to run more than once.
create table if not exists public.shared_links (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  original_url text not null,
  resolved_url text,
  platform text,
  name text,
  review text not null default 'new',
  aff_url text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.shared_links drop constraint if exists shared_links_review_chk;
alter table public.shared_links add constraint shared_links_review_chk check (review in ('new','approved','skipped'));
alter table public.shared_links enable row level security;   -- written only by the resolve-link function; read via admin RPC
create index if not exists shared_links_new on public.shared_links (review, created_at desc);

create or replace function public.admin_links(p_review text default 'new')
returns table (id bigint, original_url text, resolved_url text, platform text, name text, email text, created_at timestamptz, times int, review text)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select max(s.id), min(s.original_url), s.resolved_url, min(s.platform), min(s.name), min(u.email::text), max(s.created_at), count(*)::int, min(s.review)
    from shared_links s left join auth.users u on u.id = s.user_id
   where p_review = 'all' or s.review = p_review
   group by s.resolved_url
   order by max(s.created_at) desc limit 200;
end $$;
revoke all on function public.admin_links(text) from public;
grant execute on function public.admin_links(text) to authenticated;

-- Approve: adds the item to the app (product + listing + price). For Lazada, p_link should be the converted affiliate link.
create or replace function public.admin_review_link(p_id bigint, p_action text, p_category text default null, p_name text default null,
                                                    p_price numeric default null, p_size text default null, p_link text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r shared_links; v_pid bigint; v_lid bigint; v_url text; v_plat text;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  select * into r from shared_links where id = p_id;
  if r.id is null then raise exception 'Link not found'; end if;
  if p_action = 'skip' then
    update shared_links set review = 'skipped', reviewed_at = now() where resolved_url is not distinct from r.resolved_url and review = 'new';
    return jsonb_build_object('ok', true, 'action', 'skipped');
  end if;
  if p_action <> 'approve' then raise exception 'Unknown action %', p_action; end if;
  if coalesce(p_category,'') = '' then raise exception 'Pick a category first'; end if;
  if coalesce(trim(p_name),'') = '' then raise exception 'Type the product name'; end if;
  if coalesce(p_price,0) <= 0 then raise exception 'Type the price'; end if;
  v_plat := lower(coalesce(r.platform,''));
  if v_plat not in ('shopee','lazada') then raise exception 'Only Shopee or Lazada links'; end if;
  v_url := coalesce(nullif(trim(p_link),''), r.resolved_url, r.original_url);
  if v_plat = 'lazada' and v_url !~* 'lazada' then raise exception 'That is not a Lazada link'; end if;
  if v_plat = 'shopee' and v_url !~* '(shopee|shope\.ee)' then raise exception 'That is not a Shopee link'; end if;

  insert into products (item_code, category, brand, name, pack_size, unit, unit_qty, search_keyword)
  values ('LINK-' || p_id, p_category, '', trim(p_name), nullif(trim(p_size),''), 'piece', 1, lower(trim(p_name)))
  on conflict (item_code) do update set category = excluded.category, name = excluded.name, pack_size = excluded.pack_size
  returning id into v_pid;
  select id into v_lid from listings where platform = v_plat and product_url = v_url;
  if v_lid is null then
    insert into listings (product_id, platform, title, product_url, pack_qty) values (v_pid, v_plat, nullif(trim(p_size),''), v_url, 1) returning id into v_lid;
  end if;
  insert into prices (listing_id, price_rm, checked_at) values (v_lid, p_price, now());
  update shared_links set review = 'approved', reviewed_at = now(), aff_url = nullif(trim(p_link),'')
   where resolved_url is not distinct from r.resolved_url and review = 'new';
  return jsonb_build_object('ok', true, 'action', 'approved', 'product_id', v_pid);
end $$;
revoke all on function public.admin_review_link(bigint, text, text, text, numeric, text, text) from public;
grant execute on function public.admin_review_link(bigint, text, text, text, numeric, text, text) to authenticated;

select count(*) as links_waiting from public.shared_links where review = 'new';
