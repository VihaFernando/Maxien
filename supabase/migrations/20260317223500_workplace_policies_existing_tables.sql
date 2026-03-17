-- Additive RLS policies for workplace-linked rows in existing tables.
-- This does NOT alter existing policies; it only enables workplace collaboration.

begin;

do $$
begin
  -- TASKS
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='tasks') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='tasks' and policyname='tasks_insert_workplace_member'
    ) then
      execute $p$
        create policy tasks_insert_workplace_member
        on public.tasks
        for insert
        to authenticated
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
          and user_id = auth.uid()
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='tasks' and policyname='tasks_update_workplace_member'
    ) then
      execute $p$
        create policy tasks_update_workplace_member
        on public.tasks
        for update
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        )
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='tasks' and policyname='tasks_delete_workplace_member'
    ) then
      execute $p$
        create policy tasks_delete_workplace_member
        on public.tasks
        for delete
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;
  end if;

  -- PROJECTS
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='projects') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='projects' and policyname='projects_insert_workplace_member'
    ) then
      execute $p$
        create policy projects_insert_workplace_member
        on public.projects
        for insert
        to authenticated
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
          and user_id = auth.uid()
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='projects' and policyname='projects_update_workplace_member'
    ) then
      execute $p$
        create policy projects_update_workplace_member
        on public.projects
        for update
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        )
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='projects' and policyname='projects_delete_workplace_member'
    ) then
      execute $p$
        create policy projects_delete_workplace_member
        on public.projects
        for delete
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;
  end if;

  -- TASK TYPES
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='task_types') then
    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='task_types' and policyname='task_types_insert_workplace_member'
    ) then
      execute $p$
        create policy task_types_insert_workplace_member
        on public.task_types
        for insert
        to authenticated
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
          and user_id = auth.uid()
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='task_types' and policyname='task_types_update_workplace_member'
    ) then
      execute $p$
        create policy task_types_update_workplace_member
        on public.task_types
        for update
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        )
        with check (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname='public' and tablename='task_types' and policyname='task_types_delete_workplace_member'
    ) then
      execute $p$
        create policy task_types_delete_workplace_member
        on public.task_types
        for delete
        to authenticated
        using (
          workplace_id is not null
          and public.is_workplace_member(workplace_id)
        );
      $p$;
    end if;
  end if;
end $$;

commit;

