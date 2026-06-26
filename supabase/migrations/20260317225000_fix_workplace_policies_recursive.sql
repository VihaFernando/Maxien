-- Fix recursive RLS behavior by recreating the policies with non-recursive conditions.
-- Run this migration after the previous policy migration.

begin;

-- Recreate workplaces policy with EXISTS instead of IN, to avoid any potential recursion.
drop policy if exists workplaces_select_member on public.workplaces;
create policy workplaces_select_member
  on public.workplaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workplace_members wm
      where wm.workplace_id = id
        and wm.user_id = auth.uid()
        and wm.status = 'accepted'
    )
    or owner_id = auth.uid()
  );

-- Recreate workplace_members policy without using workplace_members again.
drop policy if exists workplace_members_select_owner_or_self on public.workplace_members;
create policy workplace_members_select_owner_or_self
  on public.workplace_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.workplaces w
      where w.id = workplace_id
        and w.owner_id = auth.uid()
    )
  );

commit;
