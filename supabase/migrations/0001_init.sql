-- Fits: full schema (tables, RLS, views, RPCs, storage).
-- Paste into the Supabase SQL editor on a fresh project and run once.
-- Safe to re-run: tables use "if not exists", functions/views use "create or replace",
-- policies are dropped before being created.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  admin_id uuid not null references public.profiles (id),
  reveal_time text not null default '09:00',
  post_deadline_time text not null default '12:00',
  results_time text not null default '18:00',
  battles_per_day int null,
  allow_share_voting boolean not null default false,
  comments_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  group_id uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz null,
  primary key (group_id, profile_id)
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  number int not null,
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (group_id, number)
);

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  season_id uuid null references public.seasons (id) on delete set null,
  player_a uuid not null references public.profiles (id),
  player_b uuid not null references public.profiles (id),
  reveal_at timestamptz not null,
  post_deadline timestamptz not null,
  results_at timestamptz not null,
  closed_at timestamptz null,
  voided_at timestamptz null,
  share_code text not null unique default substr(md5(random()::text), 1, 10),
  created_at timestamptz not null default now(),
  check (player_a <> player_b)
);
create index if not exists battles_group_reveal_idx on public.battles (group_id, reveal_at);

create table if not exists public.posts (
  battle_id uuid not null references public.battles (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  media_path text not null,
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  created_at timestamptz not null default now(),
  primary key (battle_id, profile_id)
);

create table if not exists public.votes (
  battle_id uuid not null references public.battles (id) on delete cascade,
  voter_id uuid not null references auth.users on delete cascade,
  side text not null check (side in ('a', 'b')),
  comment text null check (char_length(comment) <= 280),
  created_at timestamptz not null default now(),
  primary key (battle_id, voter_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_created_idx on public.messages (group_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users on delete cascade,
  battle_id uuid null references public.battles (id) on delete cascade,
  message_id uuid null references public.messages (id) on delete cascade,
  reason text null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions used by RLS
-- ---------------------------------------------------------------------------

create or replace function public.is_member(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = gid and m.profile_id = auth.uid() and m.left_at is null
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and g.admin_id = auth.uid()
  );
$$;

revoke all on function public.is_member(uuid) from public;
revoke all on function public.is_group_admin(uuid) from public;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_group_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.memberships enable row level security;
alter table public.seasons enable row level security;
alter table public.battles enable row level security;
alter table public.posts enable row level security;
alter table public.votes enable row level security;
alter table public.messages enable row level security;
alter table public.reports enable row level security;

-- profiles: readable by any signed-in user, writable only by the owner
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- groups: members read, admin updates (creation goes through create_group)
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated using (public.is_member(id));
drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- memberships, seasons: members read (writes go through RPCs)
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated using (public.is_member(group_id));

drop policy if exists seasons_select on public.seasons;
create policy seasons_select on public.seasons
  for select to authenticated using (public.is_member(group_id));

-- battles: members read, group admin writes (custom battles, re-dating)
drop policy if exists battles_select on public.battles;
create policy battles_select on public.battles
  for select to authenticated using (public.is_member(group_id));
drop policy if exists battles_insert on public.battles;
create policy battles_insert on public.battles
  for insert to authenticated with check (public.is_group_admin(group_id));
drop policy if exists battles_update on public.battles;
create policy battles_update on public.battles
  for update to authenticated
  using (public.is_group_admin(group_id)) with check (public.is_group_admin(group_id));

-- posts: members read (inserts go through submit_post)
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (public.is_member((select b.group_id from public.battles b where b.id = battle_id)));

-- votes: you can only read your own (inserts go through cast_vote)
drop policy if exists votes_select_own on public.votes;
create policy votes_select_own on public.votes
  for select to authenticated using (voter_id = auth.uid());

-- messages: members read, members post as themselves
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated using (public.is_member(group_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (public.is_member(group_id) and author_id = auth.uid());

-- reports: write-only, as yourself
drop policy if exists reports_insert on public.reports;
create policy reports_insert on public.reports
  for insert to authenticated with check (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Views (owner rights; rows only for members of the battle's group)
-- Vote splits stay null until the battle is closed (results time, or reveal_now).
-- ---------------------------------------------------------------------------

create or replace view public.battle_tallies as
select
  b.id as battle_id,
  count(v.battle_id)::int as total,
  case when now() >= least(b.results_at, coalesce(b.closed_at, b.results_at))
    then (count(*) filter (where v.side = 'a'))::int end as votes_a,
  case when now() >= least(b.results_at, coalesce(b.closed_at, b.results_at))
    then (count(*) filter (where v.side = 'b'))::int end as votes_b
from public.battles b
left join public.votes v on v.battle_id = b.id
where public.is_member(b.group_id)
group by b.id;

create or replace view public.battle_comments as
select
  v.battle_id,
  v.side,
  coalesce(p.name, 'Guest') as author_name,
  p.emoji as author_emoji,
  v.comment as body,
  v.created_at
from public.votes v
join public.battles b on b.id = v.battle_id
left join public.profiles p on p.id = v.voter_id
where v.comment is not null
  and public.is_member(b.group_id)
  and now() >= least(b.results_at, coalesce(b.closed_at, b.results_at));

grant select on public.battle_tallies to authenticated;
grant select on public.battle_comments to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs (security definer; errors are raised as short codes the client matches on)
-- ---------------------------------------------------------------------------

create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'no_profile';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    raise exception 'bad_name';
  end if;
  insert into public.groups (name, admin_id) values (v_name, v_uid) returning id into v_id;
  insert into public.memberships (group_id, profile_id) values (v_id, v_uid);
  return v_id;
end;
$$;

create or replace function public.group_by_invite(p_code text)
returns table (id uuid, name text, member_count int)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name,
    (select count(*)::int from public.memberships m where m.group_id = g.id and m.left_at is null)
  from public.groups g
  where g.invite_code = lower(btrim(p_code));
$$;

create or replace function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_gid uuid;
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  select g.id into v_gid from public.groups g where g.invite_code = lower(btrim(p_code));
  if v_gid is null then raise exception 'bad_code'; end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'no_profile';
  end if;
  insert into public.memberships as m (group_id, profile_id)
  values (v_gid, v_uid)
  on conflict (group_id, profile_id) do update
    set joined_at = case when m.left_at is not null then now() else m.joined_at end,
        left_at = null;
  return v_gid;
end;
$$;

create or replace function public.submit_post(p_battle uuid, p_path text, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  b public.battles%rowtype;
begin
  select * into b from public.battles where id = p_battle;
  if not found then raise exception 'not_open'; end if;
  if v_uid is null or v_uid not in (b.player_a, b.player_b) then
    raise exception 'not_player';
  end if;
  if now() < b.reveal_at or b.closed_at is not null or b.voided_at is not null then
    raise exception 'not_open';
  end if;
  if now() >= b.post_deadline then raise exception 'too_late'; end if;
  if split_part(coalesce(p_path, ''), '/', 1) <> v_uid::text then
    raise exception 'bad_path';
  end if;
  insert into public.posts (battle_id, profile_id, media_path, media_type)
  values (p_battle, v_uid, p_path, coalesce(p_type, 'photo'))
  on conflict (battle_id, profile_id) do update
    set media_path = excluded.media_path, media_type = excluded.media_type;
end;
$$;

create or replace function public.cast_vote(p_battle uuid, p_side text, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  b public.battles%rowtype;
  g public.groups%rowtype;
  v_comment text;
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  select * into b from public.battles where id = p_battle;
  if not found then raise exception 'not_open'; end if;
  select * into g from public.groups where id = b.group_id;
  if v_uid in (b.player_a, b.player_b) then raise exception 'battler'; end if;
  if not public.is_member(b.group_id) and not g.allow_share_voting then
    raise exception 'not_allowed';
  end if;
  if (select count(*) from public.posts p where p.battle_id = p_battle) < 2 then
    raise exception 'not_open';
  end if;
  if b.voided_at is not null
     or now() >= least(b.results_at, coalesce(b.closed_at, b.results_at)) then
    raise exception 'closed';
  end if;
  if exists (select 1 from public.votes v where v.battle_id = p_battle and v.voter_id = v_uid) then
    raise exception 'already_voted';
  end if;
  if p_side is null or p_side not in ('a', 'b') then raise exception 'bad_side'; end if;

  if g.comments_enabled then
    v_comment := nullif(left(btrim(coalesce(p_comment, '')), 280), '');
  else
    v_comment := null;
  end if;

  begin
    insert into public.votes (battle_id, voter_id, side, comment)
    values (p_battle, v_uid, p_side, v_comment);
  exception when unique_violation then
    raise exception 'already_voted';
  end;
end;
$$;

create or replace function public.reveal_now(p_battle uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gid uuid;
begin
  select group_id into v_gid from public.battles where id = p_battle;
  if v_gid is null or not public.is_group_admin(v_gid) then
    raise exception 'not_admin';
  end if;
  update public.battles set closed_at = now() where id = p_battle and closed_at is null;
end;
$$;

create or replace function public.battle_by_share_code(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  b public.battles%rowtype;
  g public.groups%rowtype;
  v_closed boolean;
  v_total int;
  v_a int;
  v_b int;
begin
  select * into b from public.battles where share_code = btrim(p_code);
  if not found then return null; end if;
  select * into g from public.groups where id = b.group_id;
  if not g.allow_share_voting then return null; end if;

  v_closed := b.voided_at is not null
              or now() >= least(b.results_at, coalesce(b.closed_at, b.results_at));
  select count(*)::int,
         (count(*) filter (where side = 'a'))::int,
         (count(*) filter (where side = 'b'))::int
    into v_total, v_a, v_b
    from public.votes where battle_id = b.id;

  return jsonb_build_object(
    'battle', to_jsonb(b),
    'group', jsonb_build_object('name', g.name, 'comments_enabled', g.comments_enabled),
    'players', (
      select coalesce(jsonb_agg(
               jsonb_build_object('id', p.id, 'name', p.name, 'emoji', p.emoji)
               order by (p.id = b.player_a) desc), '[]'::jsonb)
      from public.profiles p where p.id in (b.player_a, b.player_b)
    ),
    'posts', (
      select coalesce(jsonb_agg(
               jsonb_build_object('profile_id', po.profile_id, 'media_path', po.media_path, 'media_type', po.media_type)
               order by (po.profile_id = b.player_a) desc), '[]'::jsonb)
      from public.posts po where po.battle_id = b.id
    ),
    'tally', jsonb_build_object(
      'total', v_total,
      'votes_a', case when v_closed then v_a end,
      'votes_b', case when v_closed then v_b end
    ),
    'comments', case when v_closed and g.comments_enabled then (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'side', v.side,
                 'author_name', coalesce(pr.name, 'Guest'),
                 'author_emoji', pr.emoji,
                 'body', v.comment,
                 'created_at', v.created_at)
               order by v.created_at), '[]'::jsonb)
      from public.votes v
      left join public.profiles pr on pr.id = v.voter_id
      where v.battle_id = b.id and v.comment is not null
    ) else '[]'::jsonb end
  );
end;
$$;

-- Helper for create_season: is a specific profile an active member of a group?
create or replace function public.is_member_of(gid uuid, pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.group_id = gid and m.profile_id = pid and m.left_at is null
  );
$$;

create or replace function public.create_season(p_group uuid, p_starts date, p_ends date, p_battles jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_latest_end date;
  v_number int;
  v_id uuid;
begin
  if v_uid is null or not public.is_member(p_group) then raise exception 'not_member'; end if;
  if not public.is_group_admin(p_group) then
    select max(ends_on) into v_latest_end from public.seasons where group_id = p_group;
    if v_latest_end is not null and v_latest_end >= current_date then
      raise exception 'season_active';
    end if;
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

create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  update public.memberships set left_at = now()
    where group_id = p_group and profile_id = v_uid and left_at is null;
  update public.battles set voided_at = now()
    where group_id = p_group
      and (player_a = v_uid or player_b = v_uid)
      and voided_at is null
      and closed_at is null
      and results_at > now();
end;
$$;

revoke all on function public.create_group(text) from public;
revoke all on function public.group_by_invite(text) from public;
revoke all on function public.join_group(text) from public;
revoke all on function public.submit_post(uuid, text, text) from public;
revoke all on function public.cast_vote(uuid, text, text) from public;
revoke all on function public.reveal_now(uuid) from public;
revoke all on function public.battle_by_share_code(text) from public;
revoke all on function public.create_season(uuid, date, date, jsonb) from public;
revoke all on function public.is_member_of(uuid, uuid) from public;
revoke all on function public.leave_group(uuid) from public;

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.group_by_invite(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.submit_post(uuid, text, text) to authenticated;
grant execute on function public.cast_vote(uuid, text, text) to authenticated;
grant execute on function public.reveal_now(uuid) to authenticated;
grant execute on function public.battle_by_share_code(text) to authenticated;
grant execute on function public.create_season(uuid, date, date, jsonb) to authenticated;
grant execute on function public.is_member_of(uuid, uuid) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime for chat (ignored if already added)
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: public bucket "outfits". Uploads must go into a folder named after the user id.
-- The seed script uses the service role for "seed/..." paths.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('outfits', 'outfits', true)
on conflict (id) do nothing;

drop policy if exists outfits_insert_own_folder on storage.objects;
create policy outfits_insert_own_folder on storage.objects
  for insert to authenticated
  with check (bucket_id = 'outfits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists outfits_select_own_folder on storage.objects;
create policy outfits_select_own_folder on storage.objects
  for select to authenticated
  using (bucket_id = 'outfits' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists outfits_update_own_folder on storage.objects;
create policy outfits_update_own_folder on storage.objects
  for update to authenticated
  using (bucket_id = 'outfits' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'outfits' and (storage.foldername(name))[1] = auth.uid()::text);
