-- Test accounts: still work normally, but are left out of all growth counts. Safe to run more than once.
alter table public.profiles add column if not exists is_test boolean not null default false;
update public.profiles set is_test = true where lower(email) in ('gaaneson21@gmail.com');
create or replace function public.member_count() returns int
language sql security definer set search_path = public stable as $$
  select count(*)::int from auth.users u where not exists (select 1 from profiles p where p.id = u.id and (p.is_admin or p.is_test));
$$;
revoke all on function public.member_count() from public;
