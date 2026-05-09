create table if not exists public.app_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

drop policy if exists "app_state_public_read" on public.app_state;
create policy "app_state_public_read"
on public.app_state
for select
using (true);

drop policy if exists "app_state_public_insert" on public.app_state;
create policy "app_state_public_insert"
on public.app_state
for insert
with check (true);

drop policy if exists "app_state_public_update" on public.app_state;
create policy "app_state_public_update"
on public.app_state
for update
using (true)
with check (true);
