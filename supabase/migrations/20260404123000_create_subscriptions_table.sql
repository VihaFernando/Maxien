-- Create a user-owned subscriptions table with monthly renewal tracking.

begin;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null default 0,
  currency text not null default 'LKR',
  renewal_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

-- Allow authenticated users to read their own subscription rows.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_select_owner'
  ) then
    execute $p$
      create policy subscriptions_select_owner
      on public.subscriptions
      for select
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;
end $$;

-- Allow authenticated users to insert subscription rows tied to themselves.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_insert_owner'
  ) then
    execute $p$
      create policy subscriptions_insert_owner
      on public.subscriptions
      for insert
      to authenticated
      with check (user_id = auth.uid());
    $p$;
  end if;
end $$;

-- Allow authenticated users to update their own subscription rows.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_update_owner'
  ) then
    execute $p$
      create policy subscriptions_update_owner
      on public.subscriptions
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    $p$;
  end if;
end $$;

-- Allow authenticated users to delete their own subscription rows.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'subscriptions' and policyname = 'subscriptions_delete_owner'
  ) then
    execute $p$
      create policy subscriptions_delete_owner
      on public.subscriptions
      for delete
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;
end $$;

commit;
