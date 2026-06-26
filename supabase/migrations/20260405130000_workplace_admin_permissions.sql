-- Admin role defaults and admin-level permissions for workplace management.

begin;

-- Migration/runtime safety:
-- During direct SQL execution (no JWT), auth.uid() is null and the existing
-- role/member-role integrity triggers can block system backfills.
-- Keep normal checks for authenticated app calls.
create or replace function public.enforce_role_workplace_integrity()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_workplace_member(new.workplace_id) then
    raise exception 'not_workplace_member';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_member_role_integrity()
returns trigger
language plpgsql
as $$
declare
  v_workplace_id uuid;
begin
  select workplace_id into v_workplace_id
  from public.workplace_members
  where id = new.member_id;

  if v_workplace_id is null then
    raise exception 'member_not_found';
  end if;

  if v_workplace_id <> new.workplace_id then
    raise exception 'member_workplace_mismatch';
  end if;

  if auth.uid() is null then
    return new;
  end if;

  if not public.is_workplace_member(new.workplace_id) then
    raise exception 'not_workplace_member';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 1) Admin helper
-- ---------------------------------------------------------------------------

create or replace function public.is_workplace_admin(p_workplace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.workplace_members wm
    left join public.member_roles mr
      on mr.member_id = wm.id
      and mr.workplace_id = wm.workplace_id
    left join public.roles r
      on r.id = mr.role_id
      and r.workplace_id = wm.workplace_id
    where wm.workplace_id = p_workplace_id
      and wm.user_id = auth.uid()
      and wm.status = 'accepted'
      and (
        wm.role = 'owner'
        or lower(coalesce(r.name, '')) = 'admin'
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2) Ensure default Admin role exists and owners are assigned
-- ---------------------------------------------------------------------------

insert into public.roles (workplace_id, created_by, name, description, color)
select
  w.id,
  w.owner_id,
  'Admin',
  'Full management access for this workplace.',
  '#ef4444'
from public.workplaces w
where not exists (
  select 1
  from public.roles r
  where r.workplace_id = w.id
    and lower(r.name) = 'admin'
);

insert into public.member_roles (workplace_id, member_id, role_id, assigned_by)
select
  wm.workplace_id,
  wm.id,
  r.id,
  wm.user_id
from public.workplace_members wm
join public.roles r
  on r.workplace_id = wm.workplace_id
 and lower(r.name) = 'admin'
where wm.role = 'owner'
  and wm.status = 'accepted'
  and not exists (
    select 1
    from public.member_roles mr
    where mr.member_id = wm.id
      and mr.role_id = r.id
  );

create or replace function public.ensure_owner_admin_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_role_id uuid;
begin
  if new.role = 'owner' and new.status = 'accepted' then
    select id into v_admin_role_id
    from public.roles
    where workplace_id = new.workplace_id
      and lower(name) = 'admin'
    limit 1;

    if v_admin_role_id is null then
      insert into public.roles (workplace_id, created_by, name, description, color)
      values (
        new.workplace_id,
        new.user_id,
        'Admin',
        'Full management access for this workplace.',
        '#ef4444'
      )
      returning id into v_admin_role_id;
    end if;

    insert into public.member_roles (workplace_id, member_id, role_id, assigned_by)
    values (new.workplace_id, new.id, v_admin_role_id, new.user_id)
    on conflict (member_id, role_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_owner_admin_role_assignment on public.workplace_members;
create trigger trg_owner_admin_role_assignment
after insert or update of role, status on public.workplace_members
for each row
execute function public.ensure_owner_admin_role_assignment();

-- ---------------------------------------------------------------------------
-- 3) Policies and RPCs for admin management access
-- ---------------------------------------------------------------------------

-- Allow admins to update workplace settings (profile edits)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplaces' and policyname = 'workplaces_update_admin'
  ) then
    execute $p$
      create policy workplaces_update_admin
      on public.workplaces
      for update
      to authenticated
      using (public.is_workplace_admin(id))
      with check (public.is_workplace_admin(id));
    $p$;
  end if;
end $$;

-- Allow admins to see all workplace members.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workplace_members' and policyname = 'workplace_members_select_admin'
  ) then
    execute $p$
      create policy workplace_members_select_admin
      on public.workplace_members
      for select
      to authenticated
      using (public.is_workplace_admin(workplace_id));
    $p$;
  end if;
end $$;

-- Role table and member_roles table: admins can manage.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_insert_workplace_admin'
  ) then
    execute $p$
      create policy roles_insert_workplace_admin
      on public.roles
      for insert
      to authenticated
      with check (public.is_workplace_admin(workplace_id) and created_by = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_update_workplace_admin'
  ) then
    execute $p$
      create policy roles_update_workplace_admin
      on public.roles
      for update
      to authenticated
      using (public.is_workplace_admin(workplace_id))
      with check (public.is_workplace_admin(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'roles' and policyname = 'roles_delete_workplace_admin'
  ) then
    execute $p$
      create policy roles_delete_workplace_admin
      on public.roles
      for delete
      to authenticated
      using (public.is_workplace_admin(workplace_id));
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_roles' and policyname = 'member_roles_manage_workplace_admin'
  ) then
    execute $p$
      create policy member_roles_manage_workplace_admin
      on public.member_roles
      for all
      to authenticated
      using (public.is_workplace_admin(workplace_id))
      with check (public.is_workplace_admin(workplace_id));
    $p$;
  end if;
end $$;

-- Admins can invite members.
create or replace function public.create_workplace_invite(p_workplace_id uuid, p_email text)
returns public.workplace_members
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_row public.workplace_members;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_workplace_admin(p_workplace_id) then
    raise exception 'not_authorized';
  end if;

  v_user_id := public.get_user_id_by_email(p_email);
  if v_user_id is null then
    raise exception 'user_not_found';
  end if;

  insert into public.workplace_members (workplace_id, user_id, status, role)
  values (p_workplace_id, v_user_id, 'pending', 'member')
  on conflict (workplace_id, user_id)
  do update set status = excluded.status, role = excluded.role
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_workplace_invite(uuid, text) from public;
grant execute on function public.create_workplace_invite(uuid, text) to authenticated;

-- Admins can remove members (but owner row still protected by function logic).
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

  if not public.is_workplace_admin(p_workplace_id) then
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

  if v_member.role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;

  delete from public.member_roles mr
  where mr.workplace_id = p_workplace_id
    and mr.member_id = p_member_id;

  delete from public.department_members dm
  where dm.workplace_id = p_workplace_id
    and dm.user_id = v_member.user_id;

  delete from public.task_assignees ta
  using public.tasks t
  where ta.task_id = t.id
    and t.workplace_id = p_workplace_id
    and ta.user_id = v_member.user_id;

  delete from public.workplace_members wm
  where wm.id = p_member_id
    and wm.workplace_id = p_workplace_id;
end;
$$;

revoke all on function public.remove_workplace_member(uuid, uuid) from public;
grant execute on function public.remove_workplace_member(uuid, uuid) to authenticated;

commit;
