-- Add task_assignees join table and migrate existing assigned_to arrays into it.

begin;

-- Create task_assignees table
create table if not exists public.task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

-- Migrate existing assigned_to arrays into task_assignees.
-- If assigned_to is still uuid[], we unnest.
DO $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tasks'
      and column_name = 'assigned_to'
      and data_type = 'ARRAY'
  ) then
    insert into public.task_assignees (task_id, user_id)
    select t.id, unnest(t.assigned_to)
    from public.tasks t
    where t.assigned_to is not null;
  end if;
end
$$;

-- Drop assigned_to column if it exists (it often conflicts with FK/array types).
alter table public.tasks
  drop column if exists assigned_to;

commit;
