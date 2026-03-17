-- Workplace (Team Collaboration) feature - strictly additive.
-- Creates new tables, adds nullable columns, and adds new RLS policies/functions.

begin;

-- Extensions (safe / idempotent)
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) New tables
-- ---------------------------------------------------------------------------

create table if not exists public.workplaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  banner_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workplace_members (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (workplace_id, user_id)
);

create index if not exists workplace_members_workplace_id_idx on public.workplace_members(workplace_id);
create index if not exists workplace_members_user_id_idx on public.workplace_members(user_id);
create index if not exists workplaces_owner_id_idx on public.workplaces(owner_id);

-- ---------------------------------------------------------------------------
-- 2) Add nullable columns to existing tables (non-breaking)
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column if not exists workplace_id uuid references public.workplaces(id) on delete set null,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null;

alter table public.projects
  add column if not exists workplace_id uuid references public.workplaces(id) on delete set null;

alter table public.task_types
  add column if not exists workplace_id uuid references public.workplaces(id) on delete set null;

create index if not exists tasks_workplace_id_idx on public.tasks(workplace_id);
create index if not exists projects_workplace_id_idx on public.projects(workplace_id);
create index if not exists task_types_workplace_id_idx on public.task_types(workplace_id);
create index if not exists tasks_assigned_to_idx on public.tasks(assigned_to);

-- ---------------------------------------------------------------------------
-- 3) Helper functions (used by policies + invite flow)
-- ---------------------------------------------------------------------------

-- Returns true if the current user is an accepted member of the workplace.
create or replace function public.is_workplace_member(p_workplace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workplace_members wm
    where wm.workplace_id = p_workplace_id
      and wm.user_id = auth.uid()
      and wm.status = 'accepted'
  );
$$;

-- Returns true if the current user is the owner of the workplace.
create or replace function public.is_workplace_owner(p_workplace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workplaces w
    where w.id = p_workplace_id
      and w.owner_id = auth.uid()
  );
$$;

-- SECURITY DEFINER: resolves a user_id from an email in auth.users.
-- Kept narrow: only callable by authenticated users, used by invite RPC below.
create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to authenticated;

-- Creates an invite (pending membership) by email.
-- Only workplace owner can invite.
create or replace function public.create_workplace_invite(p_workplace_id uuid, p_email text)
returns public.workplace_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_row public.workplace_members;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_workplace_owner(p_workplace_id) then
    raise exception 'not_authorized';
  end if;

  v_user_id := public.get_user_id_by_email(p_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.workplace_members (workplace_id, user_id, status, role)
  values (p_workplace_id, v_user_id, 'pending', 'member')
  on conflict (workplace_id, user_id)
  do update set status = excluded.status, role = excluded.role
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_workplace_invite(uuid, text) from public;
grant execute on function public.create_workplace_invite(uuid, text) to authenticated;

-- Creates a workplace and also inserts the owner membership row as accepted/owner.
create or replace function public.create_workplace(p_name text, p_description text, p_banner_url text)
returns public.workplaces
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_workplace public.workplaces;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  insert into public.workplaces (name, description, banner_url, owner_id)
  values (p_name, nullif(trim(p_description), ''), nullif(trim(p_banner_url), ''), auth.uid())
  returning * into v_workplace;

  insert into public.workplace_members (workplace_id, user_id, status, role)
  values (v_workplace.id, auth.uid(), 'accepted', 'owner')
  on conflict (workplace_id, user_id) do nothing;

  return v_workplace;
end;
$$;

revoke all on function public.create_workplace(text, text, text) from public;
grant execute on function public.create_workplace(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) RLS for new tables (and additive policies for existing tables)
-- ---------------------------------------------------------------------------

alter table public.workplaces enable row level security;
alter table public.workplace_members enable row level security;

-- Workplaces: members (accepted) can read; owner can manage.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplaces' and policyname = 'workplaces_select_member'
  ) then
    execute $p$
      create policy workplaces_select_member
      on public.workplaces
      for select
      to authenticated
      using (public.is_workplace_member(id) or owner_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplaces' and policyname = 'workplaces_update_owner'
  ) then
    execute $p$
      create policy workplaces_update_owner
      on public.workplaces
      for update
      to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
    $p$;
  end if;
end $$;

-- Workplace members: owner can list/manage; user can read/update their own membership row.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplace_members' and policyname = 'workplace_members_select_owner_or_self'
  ) then
    execute $p$
      create policy workplace_members_select_owner_or_self
      on public.workplace_members
      for select
      to authenticated
      using (
        user_id = auth.uid()
        or public.is_workplace_owner(workplace_id)
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplace_members' and policyname = 'workplace_members_update_self'
  ) then
    execute $p$
      create policy workplace_members_update_self
      on public.workplace_members
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    $p$;
  end if;
end $$;

-- Additive workplace-read policies for existing tables:
-- Allow accepted workplace members to read workplace-linked records.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tasks') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='tasks' and policyname='tasks_select_workplace_member'
    ) then
      execute $p$
        create policy tasks_select_workplace_member
        on public.tasks
        for select
        to authenticated
        using (workplace_id is not null and public.is_workplace_member(workplace_id));
      $p$;
    end if;
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='projects') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='projects' and policyname='projects_select_workplace_member'
    ) then
      execute $p$
        create policy projects_select_workplace_member
        on public.projects
        for select
        to authenticated
        using (workplace_id is not null and public.is_workplace_member(workplace_id));
      $p$;
    end if;
  end if;

  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='task_types') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='task_types' and policyname='task_types_select_workplace_member'
    ) then
      execute $p$
        create policy task_types_select_workplace_member
        on public.task_types
        for select
        to authenticated
        using (workplace_id is not null and public.is_workplace_member(workplace_id));
      $p$;
    end if;
  end if;
end $$;

commit;

