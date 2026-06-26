-- Workplace roles feature (additive).
-- Adds workplace-scoped roles and many-to-many member role assignments.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists roles_workplace_name_key on public.roles (workplace_id, lower(name));
create index if not exists roles_workplace_id_idx on public.roles(workplace_id);
create index if not exists roles_created_by_idx on public.roles(created_by);

create table if not exists public.member_roles (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  member_id uuid not null references public.workplace_members(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (member_id, role_id)
);

create index if not exists member_roles_workplace_id_idx on public.member_roles(workplace_id);
create index if not exists member_roles_member_id_idx on public.member_roles(member_id);
create index if not exists member_roles_role_id_idx on public.member_roles(role_id);

create or replace function public.enforce_role_workplace_integrity()
returns trigger
language plpgsql
as $$
begin
  if not public.is_workplace_member(new.workplace_id) then
    raise exception 'not_workplace_member';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_roles_updated_at on public.roles;
create trigger trg_roles_updated_at
before update on public.roles
for each row execute function public.set_timestamp_updated_at();

drop trigger if exists trg_roles_workplace_integrity on public.roles;
create trigger trg_roles_workplace_integrity
before insert or update on public.roles
for each row execute function public.enforce_role_workplace_integrity();

create or replace function public.enforce_member_role_integrity()
returns trigger
language plpgsql
as $$
declare
  v_workplace_id uuid;
begin
  select workplace_id into v_workplace_id
  from public.workplace_members
  where id = new.member_id;

  if v_workplace_id is null then
    raise exception 'member_not_found';
  end if;

  if v_workplace_id <> new.workplace_id then
    raise exception 'member_workplace_mismatch';
  end if;

  if not public.is_workplace_member(new.workplace_id) then
    raise exception 'not_workplace_member';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_member_roles_integrity on public.member_roles;
create trigger trg_member_roles_integrity
before insert or update on public.member_roles
for each row execute function public.enforce_member_role_integrity();

alter table public.roles enable row level security;
alter table public.member_roles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_select_workplace_member'
  ) then
    execute $p$
      create policy roles_select_workplace_member
      on public.roles
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_insert_workplace_owner'
  ) then
    execute $p$
      create policy roles_insert_workplace_owner
      on public.roles
      for insert
      to authenticated
      with check (public.is_workplace_owner(workplace_id) and created_by = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_update_workplace_owner'
  ) then
    execute $p$
      create policy roles_update_workplace_owner
      on public.roles
      for update
      to authenticated
      using (public.is_workplace_owner(workplace_id))
      with check (public.is_workplace_owner(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_delete_workplace_owner'
  ) then
    execute $p$
      create policy roles_delete_workplace_owner
      on public.roles
      for delete
      to authenticated
      using (public.is_workplace_owner(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_roles' and policyname = 'member_roles_select_workplace_member'
  ) then
    execute $p$
      create policy member_roles_select_workplace_member
      on public.member_roles
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_roles' and policyname = 'member_roles_manage_workplace_owner'
  ) then
    execute $p$
      create policy member_roles_manage_workplace_owner
      on public.member_roles
      for all
      to authenticated
      using (public.is_workplace_owner(workplace_id))
      with check (public.is_workplace_owner(workplace_id));
    $p$;
  end if;
end $$;

commit;
