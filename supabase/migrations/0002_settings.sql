-- S7 settings and season lifecycle.

-- 1) Lets the group admin move a season's end date when battles are re-dated.
--    (0001 only allowed writes to seasons through create_season.) Only ends_on is updatable.
drop policy if exists seasons_update on public.seasons;
create policy seasons_update on public.seasons
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

revoke update on public.seasons from authenticated;
grant update (ends_on) on public.seasons to authenticated;

-- 2) Automatic next season. Unlike create_season, the "no overlap" rule applies to EVERY caller (admin too),
--    and callers are serialised on the group row, so two devices loading at once cannot create two seasons.
--    Raises 'season_active' when the group has no season yet, the latest season has not ended,
--    or a battle of the latest season is still scheduled for today or later (London dates).
create or replace function public.start_next_season(p_group uuid, p_starts date, p_ends date, p_battles jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_latest uuid;
  v_latest_end date;
  v_number int;
  v_id uuid;
  v_today date := (now() at time zone 'Europe/London')::date;
begin
  if v_uid is null or not public.is_member(p_group) then raise exception 'not_member'; end if;

  perform 1 from public.groups where id = p_group for update;

  select id, ends_on into v_latest, v_latest_end
    from public.seasons where group_id = p_group order by number desc limit 1;
  if v_latest is null or v_latest_end >= v_today then
    raise exception 'season_active';
  end if;
  if exists (select 1 from public.battles where season_id = v_latest and (reveal_at at time zone 'Europe/London')::date >= v_today) then
    raise exception 'season_active';
  end if;

  select coalesce(max(number), 0) + 1 into v_number from public.seasons where group_id = p_group;
  insert into public.seasons (group_id, number, starts_on, ends_on)
  values (p_group, v_number, p_starts, p_ends)
  returning id into v_id;

  if p_battles is not null and jsonb_typeof(p_battles) = 'array' then
    if exists (
      select 1
      from jsonb_to_recordset(p_battles) as x(player_a uuid, player_b uuid)
      where not public.is_member_of(p_group, x.player_a) or not public.is_member_of(p_group, x.player_b)
    ) then
      raise exception 'bad_players';
    end if;
    insert into public.battles (group_id, season_id, player_a, player_b, reveal_at, post_deadline, results_at)
    select p_group, v_id, x.player_a, x.player_b, x.reveal_at, x.post_deadline, x.results_at
    from jsonb_to_recordset(p_battles) as x(
      player_a uuid, player_b uuid, reveal_at timestamptz, post_deadline timestamptz, results_at timestamptz
    );
  end if;
  return v_id;
end;
$$;

revoke all on function public.start_next_season(uuid, date, date, jsonb) from public;
grant execute on function public.start_next_season(uuid, date, date, jsonb) to authenticated;

-- 3) create_season (manual "Start season"): same signature, body and grants as 0001, plus
--    the group row is locked first, and "latest season not yet ended" raises 'season_active' for EVERY caller
--    (admin too). A group with no season yet is allowed (the first manual start). Dates are London dates.
create or replace function public.create_season(p_group uuid, p_starts date, p_ends date, p_battles jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_latest_end date;
  v_today date := (now() at time zone 'Europe/London')::date;
  v_number int;
  v_id uuid;
begin
  if v_uid is null or not public.is_member(p_group) then raise exception 'not_member'; end if;

  perform 1 from public.groups where id = p_group for update;

  select max(ends_on) into v_latest_end from public.seasons where group_id = p_group;
  if v_latest_end is not null and v_latest_end >= v_today then
    raise exception 'season_active';
  end if;

  select coalesce(max(number), 0) + 1 into v_number from public.seasons where group_id = p_group;
  insert into public.seasons (group_id, number, starts_on, ends_on)
  values (p_group, v_number, p_starts, p_ends)
  returning id into v_id;

  if p_battles is not null and jsonb_typeof(p_battles) = 'array' then
    if exists (
      select 1
      from jsonb_to_recordset(p_battles) as x(player_a uuid, player_b uuid)
      where not public.is_member_of(p_group, x.player_a) or not public.is_member_of(p_group, x.player_b)
    ) then
      raise exception 'bad_players';
    end if;
    insert into public.battles (group_id, season_id, player_a, player_b, reveal_at, post_deadline, results_at)
    select p_group, v_id, x.player_a, x.player_b, x.reveal_at, x.post_deadline, x.results_at
    from jsonb_to_recordset(p_battles) as x(
      player_a uuid, player_b uuid, reveal_at timestamptz, post_deadline timestamptz, results_at timestamptz
    );
  end if;
  return v_id;
end;
$$;

revoke all on function public.create_season(uuid, date, date, jsonb) from public;
grant execute on function public.create_season(uuid, date, date, jsonb) to authenticated;
