-- Fits: security hardening from the security probe. Safe to re-run.

-- 1) Storage: only images/video, max 10 MB. Blocks uploading HTML/SVG/JS into the public
--    "outfits" bucket (which would otherwise be served from the storage domain = stored XSS).
update storage.buckets
   set allowed_mime_types = array['image/jpeg','image/png','image/webp','video/webm','video/mp4'],
       file_size_limit = 10485760
 where id = 'outfits';

-- 2) Server-side length limits (the app already validates; this stops API abuse).
--    NOT VALID = don't fail on any existing rows; applies to new inserts/updates.
alter table public.profiles drop constraint if exists profiles_name_len;
alter table public.profiles add constraint profiles_name_len
  check (char_length(btrim(name)) between 1 and 40 and char_length(emoji) between 1 and 16) not valid;

alter table public.groups drop constraint if exists groups_name_len;
alter table public.groups add constraint groups_name_len
  check (char_length(btrim(name)) between 1 and 40) not valid;

-- 3) is_member_of(gid, pid) let any signed-in user test whether someone is in any group.
--    It's only needed inside the season RPCs (security definer, run as owner), so revoke it.
revoke execute on function public.is_member_of(uuid, uuid) from public, anon, authenticated;
