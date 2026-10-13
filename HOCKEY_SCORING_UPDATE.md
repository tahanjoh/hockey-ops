# Situational impact update

- On Ice — GA remains the existing `goal_against` event and is now **stat-only**.
- Responsible — GA is `goal_against_responsible` and carries a negative impact.
- Good Forecheck and Good Backcheck each add a small positive impact.
- Final scores adjust goal/assist value modestly. Without a complete scoring timeline, the app **does not claim to identify the actual winning or losing goal**.
- Responsibility events are explicitly entered by the scorer, not inferred from on-ice status.
- To avoid double counting, do not also log a standalone Good Forecheck/Backcheck when the same action is logged as a Takeaway.
- Historical `goal_against` records are preserved and now interpreted as on-ice-only.
- If your Supabase `game_events.event_type` column has a CHECK constraint or enum, add the three new event types before deployment.
