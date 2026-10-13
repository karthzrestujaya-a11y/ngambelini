-- One-time admin tickets for testing photo-search without a member login.
-- Only reachable with the service role (RLS on, no policies). Create a ticket in the SQL editor:
--   insert into public.selftests default values returning id;
create table if not exists public.selftests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.selftests enable row level security;
