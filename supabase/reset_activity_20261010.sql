-- One-off: reset pilot test activity for everyone (keeps accounts, products, prices). Backup copies kept.
create table if not exists public.bak_clicks_20261010 as select * from public.clicks;
create table if not exists public.bak_searches_20261010 as select * from public.searches;
create table if not exists public.bak_photo_searches_20261010 as select * from public.photo_searches;
create table if not exists public.bak_shared_links_20261010 as select * from public.shared_links;
alter table public.bak_clicks_20261010 enable row level security;
alter table public.bak_searches_20261010 enable row level security;
alter table public.bak_photo_searches_20261010 enable row level security;
alter table public.bak_shared_links_20261010 enable row level security;
delete from public.clicks;
delete from public.searches;
delete from public.photo_searches;
delete from public.shared_links;
select (select count(*) from public.bak_clicks_20261010) as backed_up_taps,
       (select count(*) from public.bak_searches_20261010) as backed_up_searches,
       (select count(*) from public.clicks) + (select count(*) from public.searches) + (select count(*) from public.photo_searches) + (select count(*) from public.shared_links) as rows_left;
