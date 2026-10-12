-- Apply after 20261012010000_player_sharing.sql. Run once.
begin;
alter table public.hockey_parent_invitations
  add column email_status text not null default 'not_sent' check (email_status in ('not_sent','sending','sent','failed')),
  add column email_sent_at timestamptz,
  add column last_email_attempt_id uuid;
create table public.hockey_invitation_email_attempts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.hockey_parent_invitations(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  sent boolean,
  provider_id text
);
create index hockey_email_attempt_rate on public.hockey_invitation_email_attempts(requested_by, created_at);
create index hockey_email_attempt_invitation on public.hockey_invitation_email_attempts(invitation_id, created_at);
alter table public.hockey_invitation_email_attempts enable row level security;
revoke all on public.hockey_invitation_email_attempts from anon, authenticated;

create function public.hockey_claim_invitation_email(p_invitation uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare invite public.hockey_parent_invitations; attempt uuid; player_name text;
begin
  if auth.uid() is null or public.hockey_verified_email() is null then raise exception 'Sign in with a verified email to send invitations.'; end if;
  -- Serialize send claims per account, including invitations for different players.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  select * into invite from public.hockey_parent_invitations where id = p_invitation for update;
  if not found or invite.invited_by <> auth.uid() or not public.hockey_is_parent(invite.player_id) then
    raise exception 'You can only email invitations you created for a player you can access.';
  end if;
  if invite.status <> 'pending' or invite.expires_at <= now() then raise exception 'Only active pending invitations can be emailed.'; end if;
  if exists (select 1 from public.hockey_invitation_email_attempts where invitation_id = invite.id and created_at > now() - interval '60 seconds') then
    raise exception 'Wait one minute before sending this invitation again.';
  end if;
  if (select count(*) from public.hockey_invitation_email_attempts where requested_by = auth.uid() and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Email limit reached. Try again in an hour.';
  end if;
  if (select count(*) from public.hockey_invitation_email_attempts where invitation_id = invite.id and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'This invitation has reached its hourly email limit.';
  end if;
  insert into public.hockey_invitation_email_attempts(invitation_id, requested_by) values (invite.id, auth.uid()) returning id into attempt;
  update public.hockey_parent_invitations set email_status = 'sending', last_email_attempt_id = attempt where id = invite.id;
  select concat_ws(' ', first_name, last_name) into player_name from public.players where id = invite.player_id;
  return jsonb_build_object('attempt_id', attempt, 'email', invite.email, 'player_name', player_name, 'expires_at', invite.expires_at);
end;
$$;

create function public.hockey_finish_invitation_email(p_attempt uuid, p_sent boolean, p_provider_id text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare attempt public.hockey_invitation_email_attempts;
begin
  if auth.uid() is null or p_sent is null then raise exception 'Invalid email attempt.'; end if;
  select * into attempt from public.hockey_invitation_email_attempts where id = p_attempt for update;
  if not found or attempt.requested_by <> auth.uid() then raise exception 'Email attempt not found.'; end if;
  if attempt.sent is not null then return; end if;
  update public.hockey_invitation_email_attempts set sent = p_sent, provider_id = left(p_provider_id, 200) where id = attempt.id;
  update public.hockey_parent_invitations set email_status = case when p_sent then 'sent' else 'failed' end,
    email_sent_at = case when p_sent then now() else email_sent_at end
    where id = attempt.invitation_id and last_email_attempt_id = attempt.id and status = 'pending';
end;
$$;
revoke all on function public.hockey_claim_invitation_email(uuid) from public;
revoke all on function public.hockey_finish_invitation_email(uuid, boolean, text) from public;
grant execute on function public.hockey_claim_invitation_email(uuid) to authenticated;
grant execute on function public.hockey_finish_invitation_email(uuid, boolean, text) to authenticated;

create or replace function public.hockey_sharing_context() returns jsonb
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
        'expires_at', i.expires_at, 'membership_added', i.membership_added, 'email_status', i.email_status, 'email_sent_at', i.email_sent_at) order by i.created_at desc)
      from public.hockey_parent_invitations i join public.players p on p.id = i.player_id
      where i.invited_by = auth.uid() and public.hockey_is_parent(i.player_id)), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;


commit;
