-- Apply in Supabase SQL Editor if not already applied. Existing events are retained.
BEGIN;
ALTER TABLE public.game_events DROP CONSTRAINT IF EXISTS game_events_event_type_check;
ALTER TABLE public.game_events ADD CONSTRAINT game_events_event_type_check CHECK (event_type IN (
'goal','assist','missed_shot','sog','goal_for','goal_against','goal_against_responsible',
'good_forecheck','good_backcheck','pass','icing','breakaway','body_check','penalty',
'offside','takeaway','turnover','blocked_shot','burned','positive_note',
'improvement_note','quick_note'
));
COMMIT;
