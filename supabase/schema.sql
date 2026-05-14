
create table if not exists public.roster (
  id uuid primary key,
  name text not null,
  password text not null default '0000',
  -- Store only a stable asset identifier such as 'rayquaza', 'wumple', or 'cascoon'.
  profilepic text not null,
  completion_color text not null,
  consecutive_duty_days integer not null default 0,
  days_left integer not null default 7,
  completion_cycle integer not null default 0
);

alter table public.roster
add column if not exists password text not null default '0000';

create table if not exists public.duties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.roster (id) on delete cascade,
  duty_date date not null unique,
  iscompleted boolean not null default false
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.roster (id) on delete cascade,
  start_date date not null,
  completion_date date
);

alter table public.roster enable row level security;
alter table public.duties enable row level security;
alter table public.plans enable row level security;

grant usage on schema public to anon;
grant select, update on public.roster to anon;
grant select, insert, update on public.duties to anon;
grant select, insert, update on public.plans to anon;

drop policy if exists "Allow anonymous read roster" on public.roster;
create policy "Allow anonymous read roster"
on public.roster
for select
to anon
using (true);

drop policy if exists "Allow anonymous update roster" on public.roster;
create policy "Allow anonymous update roster"
on public.roster
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anonymous read duties" on public.duties;
create policy "Allow anonymous read duties"
on public.duties
for select
to anon
using (true);

drop policy if exists "Allow anonymous write duties" on public.duties;
create policy "Allow anonymous write duties"
on public.duties
for insert
to anon
with check (true);

drop policy if exists "Allow anonymous update duties" on public.duties;
create policy "Allow anonymous update duties"
on public.duties
for update
to anon
using (true)
with check (true);

drop policy if exists "Allow anonymous read plans" on public.plans;
create policy "Allow anonymous read plans"
on public.plans
for select
to anon
using (true);

drop policy if exists "Allow anonymous write plans" on public.plans;
create policy "Allow anonymous write plans"
on public.plans
for insert
to anon
with check (true);

drop policy if exists "Allow anonymous update plans" on public.plans;
create policy "Allow anonymous update plans"
on public.plans
for update
to anon
using (true)
with check (true);
