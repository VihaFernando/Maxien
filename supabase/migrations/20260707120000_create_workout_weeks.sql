-- Workouts feature: weekly workout plans.
-- A week owns a Monday-anchored start date and a JSONB "days" structure holding
-- per-weekday exercise lists. Weeks can be duplicated forward and edited freely.
--
-- days shape (JSONB):
-- {
--   "monday":    { "rest": false, "exercises": [ {exercise}, ... ] },
--   "tuesday":   { "rest": true,  "exercises": [] },
--   ...through sunday
-- }
-- exercise shape:
-- {
--   "id": "<client uuid>",
--   "name": "Marching in Place",
--   "amount": "2 minutes",           -- optional reps/time label
--   "points": [
--     { "text": "Stand normally.", "kind": "point" },
--     { "text": "Basically walk without moving forward", "kind": "how" },
--     { "text": "Warm-up and gets your heart rate up.", "kind": "why" }
--   ],
--   "raw": "…original pasted block…"  -- kept so nothing is ever lost
-- }

begin;

create extension if not exists "pgcrypto";

create table if not exists public.workout_weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  start_date date not null,
  days jsonb not null default '{}'::jsonb,
  total_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workout_weeks_user_id_idx on public.workout_weeks(user_id);
create index if not exists workout_weeks_start_date_idx on public.workout_weeks(user_id, start_date desc);

-- One plan per user per week-start keeps duplication idempotent and the
-- "which week am I in" lookup unambiguous.
create unique index if not exists workout_weeks_user_start_unique
  on public.workout_weeks(user_id, start_date);

alter table public.workout_weeks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_weeks' and policyname = 'workout_weeks_select_own'
  ) then
    execute $p$
      create policy workout_weeks_select_own
      on public.workout_weeks
      for select
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_weeks' and policyname = 'workout_weeks_insert_own'
  ) then
    execute $p$
      create policy workout_weeks_insert_own
      on public.workout_weeks
      for insert
      to authenticated
      with check (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_weeks' and policyname = 'workout_weeks_update_own'
  ) then
    execute $p$
      create policy workout_weeks_update_own
      on public.workout_weeks
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
    $p$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workout_weeks' and policyname = 'workout_weeks_delete_own'
  ) then
    execute $p$
      create policy workout_weeks_delete_own
      on public.workout_weeks
      for delete
      to authenticated
      using (user_id = auth.uid());
    $p$;
  end if;
end $$;

commit;
