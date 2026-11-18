-- Apply after the Saved Showcases migration (and the edit migration if installed).
begin;
create function public.hockey_showcase_publication_delete(p_player uuid,p_publication uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare item public.hockey_showcase_publications;
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can delete this showcase.'; end if;
  perform 1 from public.players where id=p_player for update;
  if not public.hockey_is_parent(p_player) then raise exception 'Player access has changed.'; end if;
  select * into item from public.hockey_showcase_publications where id=p_publication and player_id=p_player for update;
  if not found then return false; end if;
  -- Remove an exact legacy mirror, if any. Public reads use the publications table.
  delete from public.player_showcases where player_id=p_player and token=item.token;
  delete from public.hockey_showcase_publications where id=item.id and player_id=p_player;
  return true;
end; $$;
revoke all on function public.hockey_showcase_publication_delete(uuid,uuid) from public,anon;
grant execute on function public.hockey_showcase_publication_delete(uuid,uuid) to authenticated;
commit;
