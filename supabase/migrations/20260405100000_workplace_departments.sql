-- Workplace departments feature (additive).
-- Keeps existing tasks/projects tables unchanged by using link tables.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#0ea5e9',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists departments_workplace_name_key
  on public.departments (workplace_id, lower(name));
create index if not exists departments_workplace_id_idx on public.departments(workplace_id);
create index if not exists departments_created_by_idx on public.departments(created_by);

create table if not exists public.department_members (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (department_id, user_id)
);

create index if not exists department_members_department_id_idx on public.department_members(department_id);
create index if not exists department_members_workplace_id_idx on public.department_members(workplace_id);
create index if not exists department_members_user_id_idx on public.department_members(user_id);

create table if not exists public.department_task_links (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (task_id),
  unique (department_id, task_id)
);

create index if not exists department_task_links_department_id_idx on public.department_task_links(department_id);
create index if not exists department_task_links_workplace_id_idx on public.department_task_links(workplace_id);
create index if not exists department_task_links_task_id_idx on public.department_task_links(task_id);

create table if not exists public.department_project_links (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  workplace_id uuid not null references public.workplaces(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  linked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id),
  unique (department_id, project_id)
);

create index if not exists department_project_links_department_id_idx on public.department_project_links(department_id);
create index if not exists department_project_links_workplace_id_idx on public.department_project_links(workplace_id);
create index if not exists department_project_links_project_id_idx on public.department_project_links(project_id);

-- ---------------------------------------------------------------------------
-- 2) Helper functions
-- ---------------------------------------------------------------------------

create or replace function public.is_workplace_user(p_workplace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.workplace_members wm
    where wm.workplace_id = p_workplace_id
      and wm.user_id = p_user_id
      and wm.status = 'accepted'
  );
$$;

create or replace function public.department_matches_workplace(p_department_id uuid, p_workplace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.departments d
    where d.id = p_department_id
      and d.workplace_id = p_workplace_id
  );
$$;

create or replace function public.task_matches_workplace(p_task_id uuid, p_workplace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.workplace_id = p_workplace_id
  );
$$;

create or replace function public.project_matches_workplace(p_project_id uuid, p_workplace_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and p.workplace_id = p_workplace_id
  );
$$;

-- ---------------------------------------------------------------------------
-- 3) Triggers for integrity
-- ---------------------------------------------------------------------------

create or replace function public.set_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_departments_set_updated_at on public.departments;
create trigger trg_departments_set_updated_at
before update on public.departments
for each row execute function public.set_timestamp_updated_at();

create or replace function public.enforce_department_member_integrity()
returns trigger
language plpgsql
as $$
begin
  if not public.department_matches_workplace(new.department_id, new.workplace_id) then
    raise exception 'department_workplace_mismatch';
  end if;

  if not public.is_workplace_user(new.workplace_id, new.user_id) then
    raise exception 'user_not_in_workplace';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_department_members_integrity on public.department_members;
create trigger trg_department_members_integrity
before insert or update on public.department_members
for each row execute function public.enforce_department_member_integrity();

create or replace function public.enforce_department_task_link_integrity()
returns trigger
language plpgsql
as $$
begin
  if not public.department_matches_workplace(new.department_id, new.workplace_id) then
    raise exception 'department_workplace_mismatch';
  end if;

  if not public.task_matches_workplace(new.task_id, new.workplace_id) then
    raise exception 'task_workplace_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_department_task_links_integrity on public.department_task_links;
create trigger trg_department_task_links_integrity
before insert or update on public.department_task_links
for each row execute function public.enforce_department_task_link_integrity();

create or replace function public.enforce_department_project_link_integrity()
returns trigger
language plpgsql
as $$
begin
  if not public.department_matches_workplace(new.department_id, new.workplace_id) then
    raise exception 'department_workplace_mismatch';
  end if;

  if not public.project_matches_workplace(new.project_id, new.workplace_id) then
    raise exception 'project_workplace_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_department_project_links_integrity on public.department_project_links;
create trigger trg_department_project_links_integrity
before insert or update on public.department_project_links
for each row execute function public.enforce_department_project_link_integrity();

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.department_members enable row level security;
alter table public.department_task_links enable row level security;
alter table public.department_project_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'departments' and policyname = 'departments_select_workplace_member'
  ) then
    execute $p$
      create policy departments_select_workplace_member
      on public.departments
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'departments' and policyname = 'departments_insert_workplace_member'
  ) then
    execute $p$
      create policy departments_insert_workplace_member
      on public.departments
      for insert
      to authenticated
      with check (
        public.is_workplace_member(workplace_id)
        and created_by = auth.uid()
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'departments' and policyname = 'departments_update_workplace_member'
  ) then
    execute $p$
      create policy departments_update_workplace_member
      on public.departments
      for update
      to authenticated
      using (public.is_workplace_member(workplace_id))
      with check (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'departments' and policyname = 'departments_delete_workplace_member'
  ) then
    execute $p$
      create policy departments_delete_workplace_member
      on public.departments
      for delete
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_members' and policyname = 'department_members_select_workplace_member'
  ) then
    execute $p$
      create policy department_members_select_workplace_member
      on public.department_members
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_members' and policyname = 'department_members_insert_workplace_member'
  ) then
    execute $p$
      create policy department_members_insert_workplace_member
      on public.department_members
      for insert
      to authenticated
      with check (
        public.is_workplace_member(workplace_id)
        and public.is_workplace_user(workplace_id, user_id)
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_members' and policyname = 'department_members_delete_workplace_member'
  ) then
    execute $p$
      create policy department_members_delete_workplace_member
      on public.department_members
      for delete
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_task_links' and policyname = 'department_task_links_select_workplace_member'
  ) then
    execute $p$
      create policy department_task_links_select_workplace_member
      on public.department_task_links
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_task_links' and policyname = 'department_task_links_insert_workplace_member'
  ) then
    execute $p$
      create policy department_task_links_insert_workplace_member
      on public.department_task_links
      for insert
      to authenticated
      with check (
        public.is_workplace_member(workplace_id)
        and public.department_matches_workplace(department_id, workplace_id)
        and public.task_matches_workplace(task_id, workplace_id)
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_task_links' and policyname = 'department_task_links_delete_workplace_member'
  ) then
    execute $p$
      create policy department_task_links_delete_workplace_member
      on public.department_task_links
      for delete
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_project_links' and policyname = 'department_project_links_select_workplace_member'
  ) then
    execute $p$
      create policy department_project_links_select_workplace_member
      on public.department_project_links
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_project_links' and policyname = 'department_project_links_insert_workplace_member'
  ) then
    execute $p$
      create policy department_project_links_insert_workplace_member
      on public.department_project_links
      for insert
      to authenticated
      with check (
        public.is_workplace_member(workplace_id)
        and public.department_matches_workplace(department_id, workplace_id)
        and public.project_matches_workplace(project_id, workplace_id)
      );
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'department_project_links' and policyname = 'department_project_links_delete_workplace_member'
  ) then
    execute $p$
      create policy department_project_links_delete_workplace_member
      on public.department_project_links
      for delete
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;
end $$;

commit;
