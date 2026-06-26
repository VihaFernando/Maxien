-- Safely remove a member from a workplace and clean only workplace-scoped records.

begin;

create or replace function public.remove_workplace_member(
  p_workplace_id uuid,
  p_member_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member public.workplace_members;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_workplace_owner(p_workplace_id) then
    raise exception 'not_authorized';
  end if;

  select *
  into v_member
  from public.workplace_members
  where id = p_member_id
    and workplace_id = p_workplace_id
  limit 1;

  if v_member.id is null then
    raise exception 'member_not_found';
  end if;

  -- Prevent removing the owner membership row.
  if v_member.role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;

  -- Remove role assignments for this membership in this workplace.
  delete from public.member_roles mr
  where mr.workplace_id = p_workplace_id
    and mr.member_id = p_member_id;

  -- Remove department memberships tied to this user in this workplace.
  delete from public.department_members dm
  where dm.workplace_id = p_workplace_id
    and dm.user_id = v_member.user_id;

  -- Remove task assignment rows only for tasks inside this workplace.
  delete from public.task_assignees ta
  using public.tasks t
  where ta.task_id = t.id
    and t.workplace_id = p_workplace_id
    and ta.user_id = v_member.user_id;

  -- Finally remove workplace membership row.
  delete from public.workplace_members wm
  where wm.id = p_member_id
    and wm.workplace_id = p_workplace_id;
end;
$$;

revoke all on function public.remove_workplace_member(uuid, uuid) from public;
grant execute on function public.remove_workplace_member(uuid, uuid) to authenticated;

commit;
