-- Apply after 20261025010000_player_showcase.sql, including for fresh installs.
begin;
alter table public.player_showcases drop column password_hash, drop column attempts, drop column window_start;
drop function public.hockey_showcase_unlock(uuid,text);
drop function public.hockey_showcase_manage(uuid,text,text,jsonb);
create function public.hockey_showcase_manage(p_player uuid, p_action text, p_snapshot jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can manage sharing.'; end if;
 if p_action = 'disable' then
  update public.player_showcases set enabled = false where player_id = p_player returning token into result;
 elsif p_action = 'status' then
  select token into result from public.player_showcases where player_id = p_player and enabled;
 elsif p_action = 'publish' then
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text) > 500000 then raise exception 'Invalid or oversized showcase.'; end if;
  insert into public.player_showcases(player_id,snapshot) values(p_player,p_snapshot)
  on conflict(player_id) do update set snapshot = excluded.snapshot, enabled = true, token = gen_random_uuid()
  returning token into result;
 elsif p_action = 'rotate' then
  update public.player_showcases set token = gen_random_uuid() where player_id = p_player and enabled returning token into result;
  if result is null then raise exception 'Publish a showcase first.'; end if;
 else raise exception 'Unknown action.';
 end if;
 return result;
end; $$;
create function public.hockey_showcase_read(p_token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
 select snapshot from public.player_showcases where token = p_token and enabled;
$$;
revoke all on function public.hockey_showcase_manage(uuid,text,jsonb) from public, anon;
grant execute on function public.hockey_showcase_manage(uuid,text,jsonb) to authenticated;
revoke all on function public.hockey_showcase_read(uuid) from public;
grant execute on function public.hockey_showcase_read(uuid) to anon, authenticated;
-- Previously password-protected links must not silently become open links.
update public.player_showcases set token = gen_random_uuid(), enabled = false;
commit;
