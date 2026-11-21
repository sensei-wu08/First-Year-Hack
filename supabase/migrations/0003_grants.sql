-- Fits: table privileges for the Data API.
-- Newer Supabase projects don't auto-grant table access to API roles, so every
-- table read failed with "permission denied" (42501). RLS policies in 0001 still
-- decide which rows each user can see or change; these grants only open the door.
-- Safe to re-run.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Views (owner rights, filtered by is_member) — re-stated for clarity.
grant select on public.battle_tallies to authenticated;
grant select on public.battle_comments to authenticated;

-- Future tables/migrations get the same treatment.
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
