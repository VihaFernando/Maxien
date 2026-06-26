-- Fix recursive RLS policies that could trigger stack depth limit errors.
-- This migration adjusts workspace/member policies to avoid calling functions
-- that select from the same tables and can cause recursion under RLS.

begin;

-- Redefine workplaces policy to avoid recursive function calls.
-- It allows access to workplaces where the user is an accepted member OR the owner.
drop policy if exists workplaces_select_member on public.workplaces;
create policy workplaces_select_member
  on public.workplaces
  for select
  to authenticated
  using (
    id in (
      select workplace_id
      from public.workplace_members
      where user_id = auth.uid()
        and status = 'accepted'
    )
    or owner_id = auth.uid()
  );

-- Redefine workplace_members policy to avoid selecting from workplaces
-- (which could recursively re-trigger workplaces policies).
drop policy if exists workplace_members_select_owner_or_self on public.workplace_members;
create policy workplace_members_select_owner_or_self
  on public.workplace_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or workplace_id in (
      select workplace_id
      from public.workplace_members
      where user_id = auth.uid()
        and role = 'owner'
    )
  );

commit;
