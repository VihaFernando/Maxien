-- Ensure workspace membership and owner checks do not trigger recursive RLS evaluation.
-- This migration makes the membership-check functions SECURITY DEFINER so they bypass RLS.

begin;

-- Update helper functions to run as security definer (bypass RLS) so policies can call them safely.
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
      and status = 'accepted'
  );
$$;

create or replace function public.is_workplace_owner(p_workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.workplaces w
    where w.id = p_workplace_id
      and w.owner_id = auth.uid()
  );
$$;

-- Recreate RLS policies using these safe helper functions.
drop policy if exists workplaces_select_member on public.workplaces;
create policy workplaces_select_member
  on public.workplaces
  for select
  to authenticated
  using (
    public.is_workplace_member(id)
    or public.is_workplace_owner(id)
  );

drop policy if exists workplace_members_select_owner_or_self on public.workplace_members;
create policy workplace_members_select_owner_or_self
  on public.workplace_members
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_workplace_owner(workplace_id)
  );

commit;
