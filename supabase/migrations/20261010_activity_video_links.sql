alter table public.game_events add column if not exists video_url text;

-- Allows users to attach clips to their own plays, including completed games.
drop policy if exists "Players can edit their own event video" on public.game_events;
create policy "Players can edit their own event video"
  on public.game_events for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
