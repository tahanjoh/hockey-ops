begin;
create extension if not exists pgcrypto with schema extensions;
create table public.player_showcases (
 player_id uuid primary key references public.players(id) on delete cascade,
 token uuid not null unique default gen_random_uuid(),
 password_hash text not null,
 snapshot jsonb not null,
 enabled boolean not null default true,
 attempts integer not null default 0,
 window_start timestamptz not null default now()
);
alter table public.player_showcases enable row level security;
revoke all on public.player_showcases from anon, authenticated;
create function public.hockey_showcase_manage(p_player uuid, p_action text, p_password text default null, p_snapshot jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 if not public.hockey_is_parent(p_player) then raise exception 'Only a parent with player access can manage sharing.'; end if;
 if p_action = 'disable' then
  update public.player_showcases set enabled = false where player_id = p_player returning token into result;
 elsif p_action = 'status' then
  select token into result from public.player_showcases where player_id = p_player and enabled;
 elsif p_action = 'publish' then
  if p_password is null or length(p_password) < 10 or octet_length(p_password) > 72 then raise exception 'Use a password of at least 10 characters and at most 72 bytes.'; end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' or octet_length(p_snapshot::text) > 500000 then raise exception 'Invalid or oversized showcase.'; end if;
  insert into public.player_showcases(player_id,password_hash,snapshot) values(p_player,extensions.crypt(p_password,extensions.gen_salt('bf', 10)),p_snapshot)
  on conflict(player_id) do update set password_hash = excluded.password_hash, snapshot = excluded.snapshot, enabled = true, token = gen_random_uuid(), attempts = 0, window_start = now()
  returning token into result;
 else raise exception 'Unknown action.';
 end if;
 return result;
end; $$;
create function public.hockey_showcase_unlock(p_token uuid, p_password text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item public.player_showcases;
begin
 select * into item from public.player_showcases where token = p_token and enabled for update;
 if not found then return null; end if;
 if item.window_start < now() - interval '5 minutes' then
  item.attempts := 0;
  update public.player_showcases set attempts = 0, window_start = now() where player_id = item.player_id;
 end if;
 if item.attempts >= 10 then return null; end if;
 if p_password is null or octet_length(p_password) > 72 or extensions.crypt(p_password,item.password_hash) <> item.password_hash then
  update public.player_showcases set attempts = attempts + 1 where player_id = item.player_id;
  return null;
 end if;
 return item.snapshot;
end; $$;
revoke all on function public.hockey_showcase_manage(uuid,text,text,jsonb) from public, anon;
grant execute on function public.hockey_showcase_manage(uuid,text,text,jsonb) to authenticated;
revoke all on function public.hockey_showcase_unlock(uuid,text) from public;
grant execute on function public.hockey_showcase_unlock(uuid,text) to anon, authenticated;
commit;
