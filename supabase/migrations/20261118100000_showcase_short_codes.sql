-- Apply after the existing Player Showcase and token-link migrations.
begin;
alter table public.player_showcases add column share_code text unique check (share_code ~ '^[0-9A-F]{12}$');

-- Older clients using the long-link RPC must also invalidate an issued short code.
create function public.hockey_showcase_reset_short_code() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.token is distinct from new.token then new.share_code := null; end if;
  return new;
end; $$;
create trigger hockey_showcase_token_changed before update of token on public.player_showcases
for each row execute function public.hockey_showcase_reset_short_code();
revoke all on function public.hockey_showcase_reset_short_code() from public,anon,authenticated;

-- Keep the existing long-link functions compatible, including their authorization
-- and rotation rules. A code is issued on editor status, publish, or replace.
create function public.hockey_showcase_short_manage(p_player uuid, p_action text, p_snapshot jsonb default null) returns text
language plpgsql security definer set search_path = '' as $$
declare result text; old_token uuid; candidate text;
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can manage sharing.'; end if;
  -- Serialize all management calls for this player, including the first publish.
  perform 1 from public.players where id=p_player for update;
  if not public.hockey_is_parent(p_player) then raise exception 'Player access has changed.'; end if;
  old_token := public.hockey_showcase_manage(p_player,p_action,p_snapshot);
  if p_action='disable' then return null; end if;
  if old_token is null then return null; end if;
  select share_code into result from public.player_showcases where player_id=p_player and enabled;
  if result is null or p_action in ('publish','rotate') then
    loop
      candidate := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
      begin
        update public.player_showcases set share_code=candidate where player_id=p_player and enabled returning share_code into result;
        exit;
      exception when unique_violation then
        -- Retry the unlikely collision without discarding the publish transaction.
      end;
    end loop;
  end if;
  return result;
end; $$;

create function public.hockey_showcase_short_read(p_code text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select snapshot from public.player_showcases where share_code=upper(p_code) and enabled and p_code ~* '^[0-9a-f]{12}$';
$$;
revoke all on function public.hockey_showcase_short_manage(uuid,text,jsonb) from public,anon;
grant execute on function public.hockey_showcase_short_manage(uuid,text,jsonb) to authenticated;
revoke all on function public.hockey_showcase_short_read(text) from public;
grant execute on function public.hockey_showcase_short_read(text) to anon,authenticated;
commit;
