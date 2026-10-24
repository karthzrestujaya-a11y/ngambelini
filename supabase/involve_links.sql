-- NBN: cache of Involve tracking links (one per Shopee product address) so we stay under Involve's link limit.
create table if not exists public.involve_links (
  url text primary key,
  tracking_link text not null,
  created_at timestamptz not null default now()
);
alter table public.involve_links enable row level security;
-- no policies: only the edge function (service role) reads and writes it
