-- NBN "Ajak kawan, kongsi rezeki": RM1 thank-you when a friend you invited makes their first confirmed order (min RM20).
-- Max 5 rewarded friends per day (by the day the friend joined). Rewards are paid with the normal DuitNow payout.
-- Safe to run more than once.

alter table public.profiles add column if not exists referred_by uuid references auth.users(id) on delete set null;
alter table public.profiles add column if not exists referred_at timestamptz;

-- Called by the app right after a new member logs in, with the ?ajak= code from the invite link.
-- Only works for accounts created in the last 2 days, never for yourself, and only once.
create or replace function public.set_referrer(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_ref uuid;
begin
  if auth.uid() is null or coalesce(trim(p_code),'') = '' then return false; end if;
  select id into v_ref from profiles where sub_id = lower(trim(p_code));
  if v_ref is null or v_ref = auth.uid() then return false; end if;
  update profiles set referred_by = v_ref, referred_at = now()
   where id = auth.uid() and referred_by is null and created_at > now() - interval '2 days';
  return found;
end $$;
revoke all on function public.set_referrer(text) from public;
grant execute on function public.set_referrer(text) to authenticated;

-- Rewarded referrals: friends whose first confirmed/paid order is RM20+, max 5 per referrer per day joined.
create or replace view public.referral_rewards as
with f as (
  select p.referred_by as referrer, p.id as friend, p.referred_at,
         row_number() over (partition by p.referred_by, (p.referred_at at time zone 'Asia/Kuala_Lumpur')::date order by p.referred_at) as n_day,
         exists (select 1 from clicks c where c.user_id = p.id and c.status in ('confirmed','received','paid') and coalesce(c.price_rm,0) >= 20) as qualified
  from profiles p where p.referred_by is not null
)
select referrer, friend, referred_at, (n_day <= 5) as within_cap, qualified, case when qualified and n_day <= 5 then 1.00 else 0 end::numeric(10,2) as reward_rm
from f;
revoke all on public.referral_rewards from anon, authenticated;

-- What the member sees on the "Ajak kawan" tab.
create or replace function public.my_referrals()
returns jsonb language plpgsql security definer set search_path = public stable as $$
begin
  if auth.uid() is null then return null; end if;
  return jsonb_build_object(
    'code', (select sub_id from profiles where id = auth.uid()),
    'joined', (select count(*) from profiles where referred_by = auth.uid()),
    'rewarded', (select count(*) from referral_rewards where referrer = auth.uid() and reward_rm > 0),
    'reward_rm', (select coalesce(sum(reward_rm),0) from referral_rewards where referrer = auth.uid())
  );
end $$;
revoke all on function public.my_referrals() from public;
grant execute on function public.my_referrals() to authenticated;
