-- Workouts feature: per-date exercise completion tracking.
-- One row = "this exercise, on this calendar date, is done".
-- Keyed by the actual date (not weekday) so history/streaks are possible and
-- each day of the week tracks independently.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.workout_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_id uuid not null references public.workout_weeks(id) on delete cascade,
  completion_date date not null,
  -- The client-side exercise id stored inside workout_weeks.days JSONB.
  exercise_id text not null,
  created_at timestamptz not null default now()
);

-- A given exercise on a given date is either done or not — no duplicates.
create unique index if not exists workout_completions_unique
  on public.workout_completions(user_id, completion_date, exercise_id);

create index if not exists workout_completions_lookup_idx
  on public.workout_completions(user_id, week_id, completion_date);

alter table public.workout_completions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_completions' and policyname = 'workout_completions_select_own'
  ) then
    execute $p$
      create policy workout_completions_select_own
      on public.workout_completions
      for select
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_completions' and policyname = 'workout_completions_insert_own'
  ) then
    execute $p$
      create policy workout_completions_insert_own
      on public.workout_completions
      for insert
      to authenticated
      with check (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_completions' and policyname = 'workout_completions_delete_own'
  ) then
    execute $p$
      create policy workout_completions_delete_own
      on public.workout_completions
      for delete
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;
end $$;

commit;
