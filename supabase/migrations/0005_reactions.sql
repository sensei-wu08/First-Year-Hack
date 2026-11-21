-- Fits: emoji reactions on each outfit in a battle.
-- Paste into the Supabase SQL editor and run once. Safe to re-run.
-- All access goes through the two RPCs below: the table has RLS on, no policies and no grants.

create table if not exists public.reactions (
  battle_id uuid not null references public.battles (id) on delete cascade,
  side text not null check (side in ('a', 'b')),
  reactor_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (emoji in ('🔥', '😍', '😂', '👑', '🧊')),
  created_at timestamptz not null default now(),
  primary key (battle_id, side, reactor_id, emoji)
);

alter table public.reactions enable row level security;

-- 0003's default privileges hand new tables to authenticated; take that back (the RPCs are security definer).
revoke all on public.reactions from anon, authenticated;

-- Toggle one reaction on one side of a battle. Returns true when it is now on, false when it was removed.
create or replace function public.toggle_reaction(p_battle uuid, p_side text, p_emoji text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  b public.battles%rowtype;
  v_share boolean;
  v_player uuid;
begin
  if v_uid is null then raise exception 'not_allowed'; end if;
  if p_side is null or p_side not in ('a', 'b') then raise exception 'bad_side'; end if;
  if p_emoji is null or p_emoji not in ('🔥', '😍', '😂', '👑', '🧊') then raise exception 'bad_emoji'; end if;

  select * into b from public.battles where id = p_battle;
  if not found then raise exception 'not_open'; end if;
  select g.allow_share_voting into v_share from public.groups g where g.id = b.group_id;
  if not public.is_member(b.group_id) and not coalesce(v_share, false) then
    raise exception 'not_allowed';
  end if;

  if b.voided_at is not null then raise exception 'not_open'; end if;
  v_player := case when p_side = 'a' then b.player_a else b.player_b end;
  if not exists (select 1 from public.posts p where p.battle_id = p_battle and p.profile_id = v_player) then
    raise exception 'not_open';
  end if;

  delete from public.reactions r
   where r.battle_id = p_battle and r.side = p_side and r.reactor_id = v_uid and r.emoji = p_emoji;
  if found then return false; end if;

  insert into public.reactions (battle_id, side, reactor_id, emoji)
  values (p_battle, p_side, v_uid, p_emoji)
  on conflict do nothing;
  return true;
end;
$$;

-- Counts per side and emoji, plus whether the caller has each one on. No rows when the caller can't see the battle.
create or replace function public.battle_reactions(p_battle uuid)
returns table (side text, emoji text, count int, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.side, r.emoji, count(*)::int, coalesce(bool_or(r.reactor_id = auth.uid()), false)
  from public.reactions r
  join public.battles b on b.id = r.battle_id
  join public.groups g on g.id = b.group_id
  where r.battle_id = p_battle
    and auth.uid() is not null
    and (public.is_member(b.group_id) or g.allow_share_voting)
  group by r.side, r.emoji;
$$;

revoke all on function public.toggle_reaction(uuid, text, text) from public, anon;
revoke all on function public.battle_reactions(uuid) from public, anon;
grant execute on function public.toggle_reaction(uuid, text, text) to authenticated;
grant execute on function public.battle_reactions(uuid) to authenticated;
