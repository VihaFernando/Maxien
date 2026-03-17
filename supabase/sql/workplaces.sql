-- Workplace (Team Collaboration) system
-- Apply this file in the Supabase SQL Editor.

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
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

-- ---------------------------------------------------------------------------
-- Alter existing tables (safe / idempotent)
-- ---------------------------------------------------------------------------

alter table if exists public.tasks
  add column if not exists workplace_id uuid null references public.workplaces(id) on delete set null,
  add column if not exists assigned_to uuid null references auth.users(id) on delete set null;

alter table if exists public.projects
  add column if not exists workplace_id uuid null references public.workplaces(id) on delete set null;

alter table if exists public.task_types
  add column if not exists workplace_id uuid null references public.workplaces(id) on delete set null;

alter table if exists public.calendar_events
  add column if not exists workplace_id uuid null references public.workplaces(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists workplaces_owner_id_idx on public.workplaces (owner_id);
create index if not exists workplace_members_workplace_id_idx on public.workplace_members (workplace_id);
create index if not exists workplace_members_user_id_idx on public.workplace_members (user_id);
create index if not exists workplace_members_status_idx on public.workplace_members (status);

create index if not exists tasks_workplace_id_idx on public.tasks (workplace_id);
create index if not exists tasks_workplace_assigned_to_idx on public.tasks (workplace_id, assigned_to);

create index if not exists projects_workplace_id_idx on public.projects (workplace_id);
create index if not exists task_types_workplace_id_idx on public.task_types (workplace_id);
create index if not exists calendar_events_workplace_id_idx on public.calendar_events (workplace_id);

-- ---------------------------------------------------------------------------
-- Helper functions (used by RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_workplace_member(workplace_id uuid, member_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workplace_members wm
    where wm.workplace_id = is_workplace_member.workplace_id
      and wm.user_id = is_workplace_member.member_user_id
      and wm.status = 'accepted'
  );
$$;

create or replace function public.is_workplace_member(workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_workplace_member(is_workplace_member.workplace_id, auth.uid());
$$;

create or replace function public.is_workplace_owner(workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workplaces w
    where w.id = is_workplace_owner.workplace_id
      and w.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: workplaces
-- ---------------------------------------------------------------------------

alter table public.workplaces enable row level security;

drop policy if exists workplaces_select on public.workplaces;
create policy workplaces_select
on public.workplaces
for select
to authenticated
using (
  owner_id = auth.uid()
  or public.is_workplace_member(id)
);

drop policy if exists workplaces_insert on public.workplaces;
create policy workplaces_insert
on public.workplaces
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

drop policy if exists workplaces_update on public.workplaces;
create policy workplaces_update
on public.workplaces
for update
to authenticated
using (
  owner_id = auth.uid()
)
with check (
  owner_id = auth.uid()
);

drop policy if exists workplaces_delete on public.workplaces;
create policy workplaces_delete
on public.workplaces
for delete
to authenticated
using (
  owner_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- RLS: workplace_members
-- ---------------------------------------------------------------------------

alter table public.workplace_members enable row level security;

drop policy if exists workplace_members_select on public.workplace_members;
create policy workplace_members_select
on public.workplace_members
for select
to authenticated
using (
  -- members can see the roster once accepted
  public.is_workplace_member(workplace_id)
  -- invitees can see their own invite even if pending/rejected
  or user_id = auth.uid()
  -- owners can always see
  or public.is_workplace_owner(workplace_id)
);

drop policy if exists workplace_members_insert on public.workplace_members;
create policy workplace_members_insert
on public.workplace_members
for insert
to authenticated
with check (
  -- owner can create their own owner membership row (accepted)
  (
    user_id = auth.uid()
    and role = 'owner'
    and status = 'accepted'
    and public.is_workplace_owner(workplace_id)
  )
  -- owner can invite others (pending member)
  or (
    role = 'member'
    and status = 'pending'
    and public.is_workplace_owner(workplace_id)
  )
);

drop policy if exists workplace_members_accept_reject on public.workplace_members;
create policy workplace_members_accept_reject
on public.workplace_members
for update
to authenticated
using (
  user_id = auth.uid()
  and status = 'pending'
)
with check (
  user_id = auth.uid()
  and status in ('accepted', 'rejected')
);

drop policy if exists workplace_members_owner_manage on public.workplace_members;
create policy workplace_members_owner_manage
on public.workplace_members
for update
to authenticated
using (
  public.is_workplace_owner(workplace_id)
)
with check (
  public.is_workplace_owner(workplace_id)
);

drop policy if exists workplace_members_delete on public.workplace_members;
create policy workplace_members_delete
on public.workplace_members
for delete
to authenticated
using (
  public.is_workplace_owner(workplace_id)
);

-- ---------------------------------------------------------------------------
-- RLS: tasks (personal vs workplace)
-- Assumption: tasks has a user_id column representing creator/owner for personal items.
-- ---------------------------------------------------------------------------

alter table public.tasks enable row level security;

drop policy if exists tasks_select on public.tasks;
create policy tasks_select
on public.tasks
for select
to authenticated
using (
  -- Personal: only owner
  (workplace_id is null and user_id = auth.uid())
  -- Workplace: any accepted member
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert
on public.tasks
for insert
to authenticated
with check (
  -- Personal create: only owner; assignee (if set) must be self
  (
    workplace_id is null
    and user_id = auth.uid()
    and (assigned_to is null or assigned_to = auth.uid())
  )
  -- Workplace create: creator must be a member; assignee must be a member (if set)
  or (
    workplace_id is not null
    and public.is_workplace_member(workplace_id)
    and (assigned_to is null or public.is_workplace_member(workplace_id, assigned_to))
  )
);

drop policy if exists tasks_update on public.tasks;
create policy tasks_update
on public.tasks
for update
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
)
with check (
  -- keep the same access rules on new row
  (
    workplace_id is null
    and user_id = auth.uid()
    and (assigned_to is null or assigned_to = auth.uid())
  )
  or (
    workplace_id is not null
    and public.is_workplace_member(workplace_id)
    and (assigned_to is null or public.is_workplace_member(workplace_id, assigned_to))
  )
);

drop policy if exists tasks_delete on public.tasks;
create policy tasks_delete
on public.tasks
for delete
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

-- ---------------------------------------------------------------------------
-- RLS: projects / task_types / calendar_events (personal vs workplace)
-- Assumption: each has a user_id column for personal items.
-- ---------------------------------------------------------------------------

alter table public.projects enable row level security;

drop policy if exists projects_select on public.projects;
create policy projects_select
on public.projects
for select
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists projects_insert on public.projects;
create policy projects_insert
on public.projects
for insert
to authenticated
with check (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists projects_update on public.projects;
create policy projects_update
on public.projects
for update
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
)
with check (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists projects_delete on public.projects;
create policy projects_delete
on public.projects
for delete
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

alter table public.task_types enable row level security;

drop policy if exists task_types_select on public.task_types;
create policy task_types_select
on public.task_types
for select
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists task_types_insert on public.task_types;
create policy task_types_insert
on public.task_types
for insert
to authenticated
with check (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists task_types_update on public.task_types;
create policy task_types_update
on public.task_types
for update
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
)
with check (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

drop policy if exists task_types_delete on public.task_types;
create policy task_types_delete
on public.task_types
for delete
to authenticated
using (
  (workplace_id is null and user_id = auth.uid())
  or (workplace_id is not null and public.is_workplace_member(workplace_id))
);

-- calendar_events is optional in this repo; only apply if it exists.
do $$
begin
  if to_regclass('public.calendar_events') is not null then
    execute 'alter table public.calendar_events enable row level security';

    execute 'drop policy if exists calendar_events_select on public.calendar_events';
    execute $pol$
      create policy calendar_events_select
      on public.calendar_events
      for select
      to authenticated
      using (
        (workplace_id is null and user_id = auth.uid())
        or (workplace_id is not null and public.is_workplace_member(workplace_id))
      )
    $pol$;

    execute 'drop policy if exists calendar_events_insert on public.calendar_events';
    execute $pol$
      create policy calendar_events_insert
      on public.calendar_events
      for insert
      to authenticated
      with check (
        (workplace_id is null and user_id = auth.uid())
        or (workplace_id is not null and public.is_workplace_member(workplace_id))
      )
    $pol$;

    execute 'drop policy if exists calendar_events_update on public.calendar_events';
    execute $pol$
      create policy calendar_events_update
      on public.calendar_events
      for update
      to authenticated
      using (
        (workplace_id is null and user_id = auth.uid())
        or (workplace_id is not null and public.is_workplace_member(workplace_id))
      )
      with check (
        (workplace_id is null and user_id = auth.uid())
        or (workplace_id is not null and public.is_workplace_member(workplace_id))
      )
    $pol$;

    execute 'drop policy if exists calendar_events_delete on public.calendar_events';
    execute $pol$
      create policy calendar_events_delete
      on public.calendar_events
      for delete
      to authenticated
      using (
        (workplace_id is null and user_id = auth.uid())
        or (workplace_id is not null and public.is_workplace_member(workplace_id))
      )
    $pol$;
  end if;
end $$;

