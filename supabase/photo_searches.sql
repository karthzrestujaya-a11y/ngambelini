-- Photo search usage log (3 free per month; +10 with RM20+ spend through NBN that month)
create table if not exists public.photo_searches (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  query       text,
  confidence  text,
  created_at  timestamptz not null default now()
);
create index if not exists photo_searches_user_month on public.photo_searches (user_id, created_at);
alter table public.photo_searches enable row level security;
drop policy if exists "read own photo searches" on public.photo_searches;
create policy "read own photo searches" on public.photo_searches for select to authenticated using (auth.uid() = user_id);
-- inserts happen only from the photo-search function (service role), so no insert policy for users.
