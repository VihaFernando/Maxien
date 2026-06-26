-- Allow tasks to be assigned to multiple users by changing assigned_to to uuid[].
-- This migration is additive: it converts existing single-user assignments into 1-element arrays.

begin;

alter table public.tasks
  alter column assigned_to type uuid[] using (
    case
      when assigned_to is null then null
      else array[assigned_to]
    end
  );

-- Use GIN index for array membership querying.
drop index if exists tasks_assigned_to_idx;
create index if not exists tasks_assigned_to_idx on public.tasks using gin (assigned_to);

commit;
