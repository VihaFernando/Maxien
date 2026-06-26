-- Notes feature: rich text notes with optional title.
-- Adds notes table and row-level security policies.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  content_html text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_id_idx on public.notes(user_id);
create index if not exists notes_updated_at_idx on public.notes(updated_at desc);

alter table public.notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_select_own'
  ) then
    execute $p$
      create policy notes_select_own
      on public.notes
      for select
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_insert_own'
  ) then
    execute $p$
      create policy notes_insert_own
      on public.notes
      for insert
      to authenticated
      with check (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_update_own'
  ) then
    execute $p$
      create policy notes_update_own
      on public.notes
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notes' and policyname = 'notes_delete_own'
  ) then
    execute $p$
      create policy notes_delete_own
      on public.notes
      for delete
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;
end $$;

commit;
