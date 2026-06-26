-- Allow workplace admins to atomically set member custom roles via RPC.
-- This avoids client-side multi-step RLS failures on member_roles delete/insert.

begin;

create or replace function public.set_workplace_member_roles(
  p_workplace_id uuid,
  p_member_id uuid,
  p_role_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member_exists boolean;
  v_invalid_role_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_workplace_admin(p_workplace_id) then
    raise exception 'not_authorized';
  end if;

  select exists (
    select 1
    from public.workplace_members wm
    where wm.id = p_member_id
      and wm.workplace_id = p_workplace_id
  )
  into v_member_exists;

  if not v_member_exists then
    raise exception 'member_not_found';
  end if;

  if coalesce(array_length(p_role_ids, 1), 0) > 0 then
    select count(*)
    into v_invalid_role_count
    from unnest(p_role_ids) as selected_role_id
    left join public.roles r
      on r.id = selected_role_id
     and r.workplace_id = p_workplace_id
    where r.id is null;

    if v_invalid_role_count > 0 then
      raise exception 'invalid_role_selection';
    end if;
  end if;

  delete from public.member_roles mr
  where mr.workplace_id = p_workplace_id
    and mr.member_id = p_member_id;

  if coalesce(array_length(p_role_ids, 1), 0) = 0 then
    return;
  end if;

  insert into public.member_roles (workplace_id, member_id, role_id, assigned_by)
  select p_workplace_id, p_member_id, dedup.role_id, auth.uid()
  from (
    select distinct unnest(p_role_ids) as role_id
  ) as dedup
  on conflict (member_id, role_id)
  do update set assigned_by = excluded.assigned_by;
end;
$$;

revoke all on function public.set_workplace_member_roles(uuid, uuid, uuid[]) from public;
grant execute on function public.set_workplace_member_roles(uuid, uuid, uuid[]) to authenticated;

commit;
