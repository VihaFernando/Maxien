-- Creates a read-only view for auth users, exposing only safe fields for the client.
-- This allows the frontend to look up member names without requiring supabase service role access.

begin;

create or replace view public.user_profiles as
select
  id,
  email,
  raw_user_meta_data as user_metadata
from auth.users;

-- Grant read access so authenticated clients can query the view.
grant select on public.user_profiles to authenticated;

commit;
