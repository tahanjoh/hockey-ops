-- Apply after 20261118110000_six_digit_showcase_codes.sql.
begin;
create table public.hockey_showcase_publications (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 120),
  snapshot jsonb not null check (jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=500000),
  share_code text not null unique check (share_code ~ '^([0-9]{6}|[0-9A-F]{12})$'),
  token uuid not null unique default gen_random_uuid(),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index hockey_showcase_publications_player_date on public.hockey_showcase_publications(player_id,created_at desc);
alter table public.hockey_showcase_publications enable row level security;
revoke all on public.hockey_showcase_publications from public,anon,authenticated;

-- Retain the currently stored showcase and both of its existing access links.
do $$
declare existing record; candidate text;
begin
  for existing in select * from public.player_showcases order by share_code is null loop
    candidate := existing.share_code;
    loop
      if candidate is null then
        candidate := lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000))::text,6,'0');
      end if;
      begin
        insert into public.hockey_showcase_publications(player_id,title,snapshot,share_code,token,enabled)
        values(existing.player_id,'Previously published showcase',existing.snapshot,candidate,existing.token,existing.enabled);
        exit;
      exception when unique_violation then candidate := null;
      end;
    end loop;
  end loop;
end; $$;

create function public.hockey_showcases_list(p_player uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can view saved showcases.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'title',s.title,'code',s.share_code,'enabled',s.enabled,'created_at',s.created_at,'games',case when jsonb_typeof(s.snapshot->'games')='array' then jsonb_array_length(s.snapshot->'games') else 0 end) order by s.created_at desc,s.id desc)
    from public.hockey_showcase_publications s where s.player_id=p_player),'[]'::jsonb);
end; $$;

create function public.hockey_showcase_publication_manage(p_player uuid,p_action text,p_publication uuid default null,p_snapshot jsonb default null,p_title text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.hockey_showcase_publications; candidate text; retries integer:=0;
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can manage sharing.'; end if;
  perform 1 from public.players where id=p_player for update;
  if not public.hockey_is_parent(p_player) then raise exception 'Player access has changed.'; end if;
  if p_action='publish' then
    if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>500000 then raise exception 'Invalid or oversized showcase.'; end if;
    if p_title is null or length(btrim(p_title)) not between 1 and 120 then raise exception 'Give this showcase a name (up to 120 characters).'; end if;
    loop
      retries:=retries+1;
      if retries>100 then raise exception 'Unable to issue a code. Try again.'; end if;
      candidate:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000))::text,6,'0');
      begin
        insert into public.hockey_showcase_publications(player_id,title,snapshot,share_code)
        values(p_player,btrim(p_title),p_snapshot,candidate) returning * into item;
        exit;
      exception when unique_violation then null;
      end;
    end loop;
  else
    select * into item from public.hockey_showcase_publications where id=p_publication and player_id=p_player for update;
    if not found then raise exception 'Saved showcase not found or access denied.'; end if;
    if p_action='get' then
      return jsonb_build_object('id',item.id,'title',item.title,'code',item.share_code,'enabled',item.enabled,'snapshot',item.snapshot);
    elsif p_action='disable' then
      update public.hockey_showcase_publications set enabled=false where id=item.id returning * into item;
    elsif p_action='rotate' then
      if not item.enabled then raise exception 'This showcase is disabled. Publish a new showcase to share it.'; end if;
      loop
        retries:=retries+1;
        if retries>100 then raise exception 'Unable to issue a code. Try again.'; end if;
        candidate:=lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint % 1000000))::text,6,'0');
        if candidate=item.share_code then continue; end if;
        begin
          update public.hockey_showcase_publications set share_code=candidate,token=gen_random_uuid() where id=item.id returning * into item;
          exit;
        exception when unique_violation then null;
        end;
      end loop;
    else raise exception 'Unknown action.';
    end if;
  end if;
  return jsonb_build_object('id',item.id,'title',item.title,'code',item.share_code,'enabled',item.enabled);
end; $$;

create or replace function public.hockey_showcase_short_read(p_code text) returns jsonb
language sql stable security definer set search_path='' as $$
  select snapshot from public.hockey_showcase_publications where share_code=upper(p_code) and enabled and p_code ~* '^([0-9]{6}|[0-9a-f]{12})$';
$$;
create or replace function public.hockey_showcase_read(p_token uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select snapshot from public.hockey_showcase_publications where token=p_token and enabled;
$$;
-- Retire single-showcase mutation RPCs so stale editors cannot overwrite saved links.
revoke execute on function public.hockey_showcase_manage(uuid,text,jsonb) from authenticated;
revoke execute on function public.hockey_showcase_short_manage(uuid,text,jsonb) from authenticated;
revoke all on function public.hockey_showcases_list(uuid) from public,anon;
grant execute on function public.hockey_showcases_list(uuid) to authenticated;
revoke all on function public.hockey_showcase_publication_manage(uuid,text,uuid,jsonb,text) from public,anon;
grant execute on function public.hockey_showcase_publication_manage(uuid,text,uuid,jsonb,text) to authenticated;
-- Existing read grants remain in place: only explicitly shared snapshots are public.
commit;
