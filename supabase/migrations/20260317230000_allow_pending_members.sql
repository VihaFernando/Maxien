-- Allow users with pending workplace membership to read the workplace (so they can accept/reject invites).
-- This updates membership checks to include pending status for workspace visibility.

begin;

-- Update helper function to consider pending members as members for read purposes.
create or replace function public.is_workplace_member(p_workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.workplace_members
    where workplace_id = p_workplace_id
      and user_id = auth.uid()
      and status in ('accepted', 'pending')
  );
$$;

-- Ensure select policy uses this helper.
drop policy if exists workplaces_select_member on public.workplaces;
create policy workplaces_select_member
  on public.workplaces
  for select
  to authenticated
  using (
    public.is_workplace_member(id)
    or public.is_workplace_owner(id)
  );

commit;
