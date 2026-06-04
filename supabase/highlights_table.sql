create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  document_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  highlights jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (document_id, user_id)
);

alter table public.highlights enable row level security;

create policy "Users can read own highlights"
on public.highlights
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own highlights"
on public.highlights
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own highlights"
on public.highlights
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own highlights"
on public.highlights
for delete
to authenticated
using (auth.uid() = user_id);
