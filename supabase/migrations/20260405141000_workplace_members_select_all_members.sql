-- Allow accepted workplace members to view the full workplace member list.
-- This enables non-admin users to see all members while still restricting edits.

begin;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workplace_members'
      and policyname = 'workplace_members_select_workplace_member'
  ) then
    execute $p$
      create policy workplace_members_select_workplace_member
      on public.workplace_members
      for select
      to authenticated
      using (public.is_workplace_member(workplace_id));
    $p$;
  end if;
end $$;

commit;
