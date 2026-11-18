-- Apply after 20261118120000_saved_showcases.sql.
begin;
alter table public.hockey_showcase_publications add column editor_selection jsonb;
alter table public.hockey_showcase_publications add column updated_at timestamptz not null default clock_timestamp();
create function public.hockey_showcase_modified() returns trigger
language plpgsql set search_path='' as $$
begin new.updated_at:=clock_timestamp(); return new; end; $$;
create trigger hockey_showcase_modified before update on public.hockey_showcase_publications
for each row execute function public.hockey_showcase_modified();
revoke all on function public.hockey_showcase_modified() from public,anon,authenticated;

create or replace function public.hockey_showcase_publication_manage(p_player uuid,p_action text,p_publication uuid default null,p_snapshot jsonb default null,p_title text default null) returns jsonb
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
      return jsonb_build_object('id',item.id,'title',item.title,'code',item.share_code,'enabled',item.enabled,'snapshot',item.snapshot,'selection',item.editor_selection,'updated_at',item.updated_at);
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

create function public.hockey_showcase_publication_save(p_player uuid,p_publication uuid,p_title text,p_snapshot jsonb,p_selection jsonb default null,p_expected_updated timestamptz default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.hockey_showcase_publications; created jsonb;
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can edit this showcase.'; end if;
  perform 1 from public.players where id=p_player for update;
  if not public.hockey_is_parent(p_player) then raise exception 'Player access has changed.'; end if;
  if p_title is null or length(btrim(p_title)) not between 1 and 120 then raise exception 'Enter a showcase title (up to 120 characters).'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot)<>'object' or octet_length(p_snapshot::text)>500000 then raise exception 'Invalid or oversized showcase.'; end if;
  if p_selection is not null and (jsonb_typeof(p_selection)<>'object' or octet_length(p_selection::text)>100000) then raise exception 'Invalid editor selection.'; end if;
  if p_publication is null then
    created:=public.hockey_showcase_publication_manage(p_player,'publish',null,p_snapshot,p_title);
    update public.hockey_showcase_publications set editor_selection=p_selection where id=(created->>'id')::uuid returning * into item;
  else
    select * into item from public.hockey_showcase_publications where id=p_publication and player_id=p_player for update;
    if not found then raise exception 'Saved showcase not found or access denied.'; end if;
    if p_expected_updated is null or item.updated_at is distinct from p_expected_updated then raise exception 'This showcase changed in another tab. Reopen it before saving.'; end if;
    -- Preserve the code, token, original publication date, and sharing state.
    update public.hockey_showcase_publications set title=btrim(p_title),snapshot=p_snapshot,editor_selection=p_selection
    where id=item.id returning * into item;
  end if;
  return jsonb_build_object('id',item.id,'code',item.share_code,'enabled',item.enabled,'updated_at',item.updated_at);
end; $$;
revoke all on function public.hockey_showcase_publication_save(uuid,uuid,text,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.hockey_showcase_publication_save(uuid,uuid,text,jsonb,jsonb,timestamptz) to authenticated;
commit;
