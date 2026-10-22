-- NBN referral v2 (22 Oct 2026): reward is a share of the commission we actually received on the friend's FIRST qualifying order.
--   friend's first confirmed/paid order must be RM30+ and must have a real commission_rm entered (i.e. Shopee has paid us)
--   reward = 10% of that commission (20% if the order is RM100+), at least RM0.20 (only when commission >= RM1.00), capped at RM5.00
--   max 5 rewarded friends per referrer per day joined (unchanged). Paid with the normal monthly DuitNow payout.
-- Safe to run more than once. Same columns as v1, so my_referrals() keeps working.

create or replace view public.referral_rewards as
with f as (
  select p.referred_by as referrer, p.id as friend, p.referred_at,
         row_number() over (partition by p.referred_by, (p.referred_at at time zone 'Asia/Kuala_Lumpur')::date order by p.referred_at) as n_day
  from profiles p where p.referred_by is not null
), first_order as (
  select distinct on (c.user_id) c.user_id, c.price_rm, c.commission_rm
  from clicks c
  where c.status in ('confirmed','paid') and coalesce(c.price_rm,0) >= 30 and coalesce(c.commission_rm,0) > 0
  order by c.user_id, coalesce(c.confirmed_at, c.clicked_at)
)
select f.referrer, f.friend, f.referred_at, (f.n_day <= 5) as within_cap, (o.user_id is not null) as qualified,
       case when o.user_id is not null and f.n_day <= 5 and o.commission_rm >= 1.00
            then least(5.00, greatest(0.20, round(o.commission_rm * case when o.price_rm >= 100 then 0.20 else 0.10 end, 2)))
            else 0 end::numeric(10,2) as reward_rm
from f left join first_order o on o.user_id = f.friend;
revoke all on public.referral_rewards from anon, authenticated;
