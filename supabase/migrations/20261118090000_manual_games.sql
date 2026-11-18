-- Apply in Supabase SQL Editor before installing the app changes.
begin;
alter table public.games add column if not exists entry_mode text not null default 'live' check (entry_mode in ('live','manual'));
alter table public.games add column if not exists manual_stats jsonb;
alter table public.game_events alter column period drop not null;
alter table public.game_events alter column clock_time drop not null;

-- Invoker rights retain existing row-level policies. One transaction saves game and plays.
create or replace function public.hockey_save_manual_game(p_player uuid, p_game uuid, p_data jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  saved uuid; play jsonb; stat text; val integer; kind text; total integer;
  retained uuid[] := '{}'; play_id uuid; stats jsonb := p_data->'stats';
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'You do not have permission to edit this player.'; end if;
  if coalesce(length(btrim(p_data->>'opponent')),0) not between 1 and 150
    or coalesce(p_data->>'position','') not in ('forward','defense')
    or coalesce(p_data->>'home_away','') not in ('home','away')
    or coalesce(p_data->>'game_type','') not in ('regular','tournament')
    or coalesce(p_data->>'game_date','') !~ '^\d{4}-\d{2}-\d{2}$'
    or jsonb_typeof(stats) is distinct from 'object'
    or jsonb_typeof(p_data->'plays') is distinct from 'array'
    then raise exception 'Invalid game details.'; end if;
  perform (p_data->>'game_date')::date;
  foreach stat in array array['goals','assists','plus_minus','team_score','opponent_score'] loop
    if stat in ('goals','assists','plus_minus') then val := (stats->>stat)::integer;
    else val := (p_data->>stat)::integer; end if;
    if val is not null and (val > 99 or val < case when stat = 'plus_minus' then -99 else 0 end) then raise exception 'Invalid stat total.'; end if;
  end loop;
  if jsonb_array_length(p_data->'plays') > 198 then raise exception 'Too many highlights.'; end if;
  for play in select value from jsonb_array_elements(p_data->'plays') loop
    if coalesce(play->>'event_type','') not in ('goal','assist')
      or (play->>'period')::integer not between 1 and 4
      or coalesce(play->>'clock_time','') !~ '^(\d{1,2}:[0-5]\d)?$'
      or (coalesce(play->>'video_url','') <> '' and (play->>'video_url' !~* '^https?://[^[:space:]]+$' or play->>'video_url' ~ '^https?://[^/]*@'))
      then raise exception 'Invalid highlight.'; end if;
    play_id := (play->>'id')::uuid;
    if play_id is null or play_id = any(retained) then raise exception 'Invalid highlight identifier.'; end if;
    retained := array_append(retained,play_id);
  end loop;
  foreach kind in array array['goal','assist'] loop
    select count(*) into total from jsonb_array_elements(p_data->'plays') e where e->>'event_type' = kind;
    if total > coalesce((stats->>(case when kind = 'goal' then 'goals' else 'assists' end))::integer,0) then raise exception 'Highlight count exceeds total.'; end if;
  end loop;
  if p_game is null then
    insert into public.games(player_id,created_by,opponent,game_date,position,home_away,game_type,status,completed_at,team_score,opponent_score,entry_mode,manual_stats)
    values(p_player,auth.uid(),btrim(p_data->>'opponent'),(p_data->>'game_date')::date,p_data->>'position',p_data->>'home_away',p_data->>'game_type','completed',now(),(p_data->>'team_score')::integer,(p_data->>'opponent_score')::integer,'manual',stats) returning id into saved;
  else
    select id into saved from public.games where id = p_game and player_id = p_player and entry_mode = 'manual' for update;
    if saved is null then raise exception 'This completed game cannot be edited here.'; end if;
    update public.games set opponent=btrim(p_data->>'opponent'),game_date=(p_data->>'game_date')::date,position=p_data->>'position',home_away=p_data->>'home_away',game_type=p_data->>'game_type',team_score=(p_data->>'team_score')::integer,opponent_score=(p_data->>'opponent_score')::integer,manual_stats=stats where id=saved;
  end if;
  for play in select value from jsonb_array_elements(p_data->'plays') loop
    play_id := (play->>'id')::uuid;
    if exists(select 1 from public.game_events where id=play_id and game_id <> saved) then raise exception 'Invalid highlight identifier.'; end if;
    insert into public.game_events(id,game_id,created_by,event_type,period,clock_time,video_url)
    values(play_id,saved,auth.uid(),play->>'event_type',(play->>'period')::integer,play->>'clock_time',play->>'video_url')
    on conflict(id) do update set event_type=excluded.event_type,period=excluded.period,clock_time=excluded.clock_time,video_url=excluded.video_url where public.game_events.game_id=saved;
  end loop;
  delete from public.game_events where game_id=saved and not (id=any(retained));
  -- Unannotated goals/assists are real scoring events, so existing highlight consumers work.
  foreach kind in array array['goal','assist'] loop
    total := coalesce((stats->>(case when kind='goal' then 'goals' else 'assists' end))::integer,0);
    insert into public.game_events(game_id,created_by,event_type,period,clock_time)
    select saved,auth.uid(),kind,null,null from generate_series(1,total-(select count(*)::integer from public.game_events where game_id=saved and event_type=kind));
  end loop;
  return saved;
end;
$$;
revoke all on function public.hockey_save_manual_game(uuid,uuid,jsonb) from public,anon;
grant execute on function public.hockey_save_manual_game(uuid,uuid,jsonb) to authenticated;
commit;
