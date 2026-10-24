-- NBN coin box: RM1 per friend's first confirmed order (min RM20), RM500 total pilot budget, paid out with the normal DuitNow payout (min RM5).
-- Safe to run more than once. Run after referral.sql.

create table if not exists public.referral_payouts (
  friend uuid primary key references auth.users(id) on delete cascade,
  referrer uuid not null references auth.users(id) on delete cascade,
  amount_rm numeric(10,2) not null default 1,
  paid_at timestamptz not null default now(),
  payout_ref text
);
alter table public.referral_payouts enable row level security;

create table if not exists public.referral_budget (id int primary key default 1, total_rm numeric(10,2) not null default 500);
insert into public.referral_budget(id) values (1) on conflict do nothing;
alter table public.referral_budget enable row level security;

drop view if exists public.referral_rewards cascade;
create view public.referral_rewards as
with f as (
  select p.referred_by as referrer, p.id as friend, p.referred_at,
         row_number() over (partition by p.referred_by, (p.referred_at at time zone 'Asia/Kuala_Lumpur')::date order by p.referred_at) as n_day,
         (select min(coalesce(c.confirmed_at, c.clicked_at)) from clicks c where c.user_id = p.id and c.status in ('confirmed','received','paid') and coalesce(c.price_rm,0) >= 20) as qualified_at
  from profiles p where p.referred_by is not null and p.referred_by <> p.id
), r as (
  select f.*, (qualified_at is not null) as qualified,
         case when qualified_at is not null and n_day <= 5 then row_number() over (order by qualified_at, friend) end as budget_rank
  from f
)
select referrer, friend, referred_at, (n_day <= 5) as within_cap, qualified, qualified_at,
       case when qualified and n_day <= 5 and budget_rank <= (select total_rm from referral_budget where id = 1) then 1.00 else 0 end::numeric(10,2) as reward_rm
from r;
revoke all on public.referral_rewards from anon, authenticated;

-- What the member sees: coin box (ready = waiting to be paid out, paid = already paid, pending = friends who joined but have not ordered yet).
create or replace function public.my_referrals()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if auth.uid() is null then return null; end if;
  return jsonb_build_object(
    'code', (select sub_id from profiles where id = auth.uid()),
    'joined', (select count(*) from profiles where referred_by = auth.uid()),
    'rewarded', (select count(*) from referral_rewards where referrer = auth.uid() and reward_rm > 0),
    'reward_rm', (select coalesce(sum(reward_rm),0) from referral_rewards where referrer = auth.uid()),
    'ready_rm', (select coalesce(sum(r.reward_rm),0) from referral_rewards r where r.referrer = auth.uid() and r.reward_rm > 0 and not exists (select 1 from referral_payouts x where x.friend = r.friend)),
    'paid_rm', (select coalesce(sum(amount_rm),0) from referral_payouts where referrer = auth.uid()),
    'pending', (select count(*) from referral_rewards where referrer = auth.uid() and not qualified)
  );
end $$;
revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;

-- Payout list now includes referral coins (ready) next to the 40% commission share.
drop function if exists public.admin_payouts();
create function public.admin_payouts()
returns table (user_id uuid, email text, orders int, commission_rm numeric, due_rm numeric, referral_rm numeric)
language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  with a as (
    select c.user_id as uid, count(*)::int as n, sum(coalesce(c.commission_rm,0)) as comm
      from clicks c where c.status = 'received' group by c.user_id
  ), b as (
    select r.referrer as uid, sum(r.reward_rm) as rr
      from referral_rewards r
     where r.reward_rm > 0 and not exists (select 1 from referral_payouts x where x.friend = r.friend)
     group by r.referrer
  )
  select coalesce(a.uid, b.uid), u.email::text, coalesce(a.n,0), coalesce(a.comm,0),
         round(coalesce(a.comm,0) * 0.40 + coalesce(b.rr,0), 2), coalesce(b.rr,0)
    from a full join b on a.uid = b.uid
    join auth.users u on u.id = coalesce(a.uid, b.uid)
   order by 5 desc;
end $$;
revoke all on function public.admin_payouts() from public;
grant execute on function public.admin_payouts() to authenticated;

create or replace function public.admin_pay_user(p_user uuid, p_ref text)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(trim(p_ref),'') = '' then raise exception 'Payment reference needed'; end if;
  update clicks set status = 'paid', paid_at = now(), payout_ref = trim(p_ref) where user_id = p_user and status = 'received';
  get diagnostics n = row_count;
  insert into referral_payouts(friend, referrer, amount_rm, payout_ref)
    select r.friend, r.referrer, r.reward_rm, trim(p_ref) from referral_rewards r
     where r.referrer = p_user and r.reward_rm > 0 and not exists (select 1 from referral_payouts x where x.friend = r.friend);
  return n;
end $$;
revoke all on function public.admin_pay_user(uuid, text) from public;
grant execute on function public.admin_pay_user(uuid, text) to authenticated;

-- Admin overview: budget used.
create or replace function public.admin_referral_summary()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'joined', (select count(*) from profiles where referred_by is not null),
    'rewarded', (select count(*) from referral_rewards where reward_rm > 0),
    'earned_rm', (select coalesce(sum(reward_rm),0) from referral_rewards),
    'paid_rm', (select coalesce(sum(amount_rm),0) from referral_payouts),
    'budget_rm', (select total_rm from referral_budget where id = 1));
end $$;
revoke all on function public.admin_referral_summary() from public;
grant execute on function public.admin_referral_summary() to authenticated;
