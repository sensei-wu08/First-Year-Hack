-- S7 settings: lets the group admin move a season's end date when battles are re-dated.
-- (0001 only allowed writes to seasons through create_season.)

drop policy if exists seasons_update on public.seasons;
create policy seasons_update on public.seasons
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));
