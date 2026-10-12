-- Apply once in Supabase SQL Editor (or through your migration workflow).
-- Existing schema required: players(id UUID, first_name, last_name),
-- player_memberships(player_id UUID, user_id UUID, role), games(id UUID,
-- player_id UUID, created_by UUID), game_events and game_shifts(game_id, created_by).
-- Existing policies are preserved. Test them and existing shift RPCs after applying.
begin;

create table public.hockey_parent_invitations (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) <= 254),
  invited_by uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
  accepted_by uuid references auth.users(id),
  membership_added boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create unique index hockey_one_pending_parent_invite
  on public.hockey_parent_invitations(player_id, email) where status = 'pending';
create index hockey_parent_invitation_inbox on public.hockey_parent_invitations(email);
alter table public.hockey_parent_invitations enable row level security;
-- No direct reads or writes: narrowly scoped RPCs below own all invitation access.
revoke all on public.hockey_parent_invitations from anon, authenticated;

create function public.hockey_is_parent(p_player uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_memberships m
    where m.player_id = p_player and m.user_id = auth.uid() and m.role = 'parent');
$$;
revoke all on function public.hockey_is_parent(uuid) from public;
grant execute on function public.hockey_is_parent(uuid) to authenticated;

create function public.hockey_verified_email() returns text
language sql stable security definer set search_path = '' as $$
  select lower(btrim(u.email)) from auth.users u
  where u.id = auth.uid() and u.email_confirmed_at is not null;
$$;
revoke all on function public.hockey_verified_email() from public;
grant execute on function public.hockey_verified_email() to authenticated;

create function public.hockey_sharing_context() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; mail text;
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  mail := public.hockey_verified_email();
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', concat_ws(' ', p.first_name, p.last_name)) order by p.first_name)
      from public.players p where public.hockey_is_parent(p.id)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'player_id', i.player_id,
        'player_name', concat_ws(' ', p.first_name, p.last_name), 'email', i.email, 'status', i.status, 'expires_at', i.expires_at))
      from public.hockey_parent_invitations i join public.players p on p.id = i.player_id
      where i.email = mail and i.status = 'pending' and i.expires_at > now()
        and public.hockey_is_parent_for_user(i.player_id, i.invited_by)), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'player_id', i.player_id,
        'player_name', concat_ws(' ', p.first_name, p.last_name), 'email', i.email, 'status', i.status,
        'expires_at', i.expires_at, 'membership_added', i.membership_added) order by i.created_at desc)
      from public.hockey_parent_invitations i join public.players p on p.id = i.player_id
      where i.invited_by = auth.uid() and public.hockey_is_parent(i.player_id)), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

-- Private helper, never executable by a browser user.
create function public.hockey_is_parent_for_user(p_player uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.player_memberships m
    where m.player_id = p_player and m.user_id = p_user and m.role = 'parent');
$$;
revoke all on function public.hockey_is_parent_for_user(uuid, uuid) from public, anon, authenticated;

create function public.hockey_invite_parent(p_player uuid, p_email text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare mail text := lower(btrim(p_email)); invitation uuid;
begin
  if auth.uid() is null or not public.hockey_is_parent(p_player) then raise exception 'Only a parent with access can share this player.'; end if;
  if public.hockey_verified_email() is null then raise exception 'Confirm your email before inviting another parent.'; end if;
  if mail is null or length(mail) > 254 or mail !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Enter a valid email address.'; end if;
  if mail = public.hockey_verified_email() then raise exception 'You already have access to this player.'; end if;
  perform 1 from public.players where id = p_player for update;
  -- Re-check under the lock so removal and invitation cannot race.
  if not public.hockey_is_parent(p_player) then raise exception 'Player access has changed.'; end if;
  update public.hockey_parent_invitations set status = 'revoked'
    where player_id = p_player and email = mail and status = 'pending' and expires_at <= now();
  if exists (select 1 from public.hockey_parent_invitations where player_id = p_player and email = mail and status = 'pending') then
    raise exception 'An invitation for this email is already pending.';
  end if;
  insert into public.hockey_parent_invitations(player_id, email, invited_by)
    values (p_player, mail, auth.uid()) returning id into invitation;
  return invitation;
end;
$$;

create function public.hockey_accept_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invite public.hockey_parent_invitations; added boolean := false;
begin
  if auth.uid() is null or public.hockey_verified_email() is null then raise exception 'Sign in and confirm your email to accept.'; end if;
  select * into invite from public.hockey_parent_invitations where id = p_invitation;
  if not found or invite.email <> public.hockey_verified_email() then raise exception 'Invitation not found for your verified email.'; end if;
  perform 1 from public.players where id = invite.player_id for update;
  select * into invite from public.hockey_parent_invitations where id = p_invitation for update;
  if invite.status = 'accepted' and invite.accepted_by = auth.uid() then return invite.player_id; end if;
  if invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'Invitation expired or is no longer pending. Ask for a new invitation.'; end if;
  if not public.hockey_is_parent_for_user(invite.player_id, invite.invited_by) then raise exception 'The inviting parent no longer has access.'; end if;
  if exists (select 1 from public.player_memberships where player_id = invite.player_id and user_id = auth.uid() and role <> 'parent') then
    raise exception 'Your account already has another role for this player. Contact the account administrator.';
  end if;
  if not exists (select 1 from public.player_memberships where player_id = invite.player_id and user_id = auth.uid()) then
    insert into public.player_memberships(player_id, user_id, role) values (invite.player_id, auth.uid(), 'parent');
    added := true;
  end if;
  update public.hockey_parent_invitations set status = 'accepted', accepted_by = auth.uid(), membership_added = added where id = p_invitation;
  return invite.player_id;
end;
$$;

create function public.hockey_decline_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.hockey_verified_email() is null then raise exception 'Sign in with a verified email.'; end if;
  update public.hockey_parent_invitations set status = 'declined'
    where id = p_invitation and email = public.hockey_verified_email() and status = 'pending';
  if not found then raise exception 'Pending invitation not found.'; end if;
end;
$$;

create function public.hockey_revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare invite public.hockey_parent_invitations;
begin
  select * into invite from public.hockey_parent_invitations where id = p_invitation;
  if not found or invite.invited_by <> auth.uid() or auth.uid() is null or not public.hockey_is_parent(invite.player_id) then
    raise exception 'Only the inviting parent can remove this shared access.';
  end if;
  perform 1 from public.players where id = invite.player_id for update;
  if not public.hockey_is_parent(invite.player_id) then raise exception 'Player access has changed.'; end if;
  select * into invite from public.hockey_parent_invitations where id = p_invitation for update;
  if invite.status = 'accepted' and invite.membership_added then
    delete from public.player_memberships where player_id = invite.player_id and user_id = invite.accepted_by and role = 'parent';
    -- Cancel pending invitations issued by the removed parent.
    update public.hockey_parent_invitations set status = 'revoked'
      where player_id = invite.player_id and invited_by = invite.accepted_by and status = 'pending';
  elsif invite.status <> 'pending' then
    raise exception 'This invitation cannot remove pre-existing access.';
  end if;
  update public.hockey_parent_invitations set status = 'revoked' where id = p_invitation;
end;
$$;

revoke all on function public.hockey_sharing_context() from public;
revoke all on function public.hockey_invite_parent(uuid, text) from public;
revoke all on function public.hockey_accept_invitation(uuid) from public;
revoke all on function public.hockey_decline_invitation(uuid) from public;
revoke all on function public.hockey_revoke_invitation(uuid) from public;
grant execute on function public.hockey_sharing_context() to authenticated;
grant execute on function public.hockey_invite_parent(uuid, text) to authenticated;
grant execute on function public.hockey_accept_invitation(uuid) to authenticated;
grant execute on function public.hockey_decline_invitation(uuid) to authenticated;
grant execute on function public.hockey_revoke_invitation(uuid) to authenticated;

-- Shared parent access uses membership, rather than game creator identity.
-- Definer helper avoids recursive membership policies. No membership write grant
-- is added: invitation acceptance is the only new membership creation path.
alter table public.player_memberships enable row level security;
alter table public.players enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.game_shifts enable row level security;
create policy hockey_sharing_own_membership on public.player_memberships for select to authenticated using (user_id = auth.uid());
create policy hockey_sharing_player_read on public.players for select to authenticated using (public.hockey_is_parent(id));
create policy hockey_sharing_games_read on public.games for select to authenticated using (public.hockey_is_parent(player_id));
create policy hockey_sharing_games_insert on public.games for insert to authenticated with check (public.hockey_is_parent(player_id) and created_by = auth.uid());
create policy hockey_sharing_games_update on public.games for update to authenticated using (public.hockey_is_parent(player_id)) with check (public.hockey_is_parent(player_id));
create policy hockey_sharing_games_delete on public.games for delete to authenticated using (public.hockey_is_parent(player_id));
create policy hockey_sharing_events_read on public.game_events for select to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_events_insert on public.game_events for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_events_update on public.game_events for update to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id))) with check (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_events_delete on public.game_events for delete to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_shifts_read on public.game_shifts for select to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_shifts_insert on public.game_shifts for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_shifts_update on public.game_shifts for update to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id))) with check (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
create policy hockey_sharing_shifts_delete on public.game_shifts for delete to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.hockey_is_parent(g.player_id)));
commit;
