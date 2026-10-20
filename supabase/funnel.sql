-- NBN visitor funnel: anonymous page events so we can see where people drop off.
-- No personal data: sid is a random per-browser id; src is where they came from (facebook/tiktok/google/...).
-- Safe to run more than once.

create table if not exists public.events (
  id bigserial primary key,
  at timestamptz not null default now(),
  sid text not null,
  ev text not null,
  src text,
  detail text,
  user_id uuid
);
create index if not exists events_at_idx on public.events (at);
alter table public.events enable row level security;

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to anon, authenticated
with check (
  ev in ('visit','search','compare','buy','join','otp_sent','login')
  and length(sid) between 8 and 40
  and coalesce(length(src),0) <= 40
  and coalesce(length(detail),0) <= 120
  and (user_id is null or user_id = auth.uid())
);
-- no select policy: only admins read, through admin_funnel()

-- Funnel for the last p_days days (Malaysia time). Counts unique browsers per step, overall and by source.
create or replace function public.admin_funnel(p_days int default 7)
returns jsonb language plpgsql security definer set search_path = public stable as $$
declare since timestamptz := ((now() at time zone 'Asia/Kuala_Lumpur')::date - (greatest(p_days,1) - 1)) at time zone 'Asia/Kuala_Lumpur';
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'steps', (select coalesce(jsonb_object_agg(ev, n), '{}'::jsonb) from (
        select ev, count(distinct sid) n from events where "at" >= since group by ev) s),
    'by_src', (select coalesce(jsonb_agg(x order by x.visits desc), '[]'::jsonb) from (
        select coalesce(v.src,'direct') src, count(distinct v.sid) visits,
               count(distinct l.sid) logins
        from events v left join events l on l.sid = v.sid and l.ev = 'login' and l."at" >= since
        where v.ev = 'visit' and v."at" >= since group by 1) x),
    'days', (select coalesce(jsonb_agg(d order by d.day), '[]'::jsonb) from (
        select ("at" at time zone 'Asia/Kuala_Lumpur')::date as day,
               count(distinct sid) filter (where ev='visit') visits,
               count(distinct sid) filter (where ev='search') searches,
               count(distinct sid) filter (where ev='buy') buys,
               count(distinct sid) filter (where ev='login') logins
        from events where "at" >= since group by 1) d)
  );
end $$;
revoke all on function public.admin_funnel(int) from public;
grant execute on function public.admin_funnel(int) to authenticated;
