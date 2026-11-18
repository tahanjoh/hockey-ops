import { calculateGameImpact } from "./gameImpact";

export type SummaryEvent = { id?: string; event_type: string; period?: number; clock_time?: string; video_url?: string; video_links?: unknown; note_text?: string };
export type SummaryGame = { entry_mode?: string; manual_stats?: { goals: number | null; assists: number | null; plus_minus: number | null }; id: string; opponent: string; game_date: string; position: string; team_score: number | null; opponent_score: number | null; game_events: SummaryEvent[]; video_url?: string; video_links?: unknown };

export function summarizeGames(games: SummaryGame[]) {
  const trackedGames = games.filter(game => game.entry_mode !== "manual");
  const scoringEvents = games.flatMap(game => game.game_events ?? []);
  const events = trackedGames.flatMap(game => game.game_events ?? []);
  const count = (...types: string[]) => events.filter(event => types.includes(event.event_type)).length;
  const goals = scoringEvents.filter(e => e.event_type === "goal").length;
  const assists = scoringEvents.filter(e => e.event_type === "assist").length;
  const shots = count("shot", "missed_shot", "sog", "goal");
  const sog = count("sog", "goal");
  const goalsKnown = games.filter(g => g.entry_mode !== "manual" || g.manual_stats?.goals != null).length;
  const assistsKnown = games.filter(g => g.entry_mode !== "manual" || g.manual_stats?.assists != null).length;
  const pointsGames = games.filter(g => g.entry_mode !== "manual" || (g.manual_stats?.goals != null && g.manual_stats?.assists != null));
  const knownPoints = pointsGames.flatMap(g => g.game_events ?? []).filter(e => ["goal","assist"].includes(e.event_type)).length;
  const plusMinusKnown = trackedGames.length + games.filter(g => g.entry_mode === "manual" && g.manual_stats?.plus_minus != null).length;
  const scoredGames = games.filter(game => game.team_score !== null && game.opponent_score !== null);
  return {
    goalsKnown, assistsKnown, plusMinusKnown, pointsKnown: pointsGames.length, pointsPerGame: pointsGames.length ? knownPoints / pointsGames.length : null, trackedGames: trackedGames.length, manualGames: games.length - trackedGames.length, plusMinus: games.filter(g => g.entry_mode === "manual").reduce((sum,g) => sum + (g.manual_stats?.plus_minus ?? 0), 0) + count("goal_for", "goal", "assist") - count("goal_against"), games: games.length, goals, assists, points: goals + assists, shots, sog,
    shooting: sog ? count("goal") / sog * 100 : null,
    averageImpact: trackedGames.length ? trackedGames.reduce((sum, game) => sum + calculateGameImpact(game.position === "defense" ? "defense" : "forward", game.game_events ?? [], { team_score: game.team_score, opponent_score: game.opponent_score }).gameImpact, 0) / trackedGames.length : null,
    wins: scoredGames.filter(game => game.team_score! > game.opponent_score!).length,
    losses: scoredGames.filter(game => game.team_score! < game.opponent_score!).length,
    ties: scoredGames.filter(game => game.team_score === game.opponent_score).length,
    details: [
      ["On-ice goals for", count("goal_for", "goal", "assist")],
      ["On-ice goals against", count("goal_against")],
      ["Responsible for goals against", count("goal_against_responsible")],
      ["Good forechecks", count("good_forecheck")],
      ["Good backchecks", count("good_backcheck")],
      ["On-ice differential", count("goal_for", "goal", "assist") - count("goal_against")],
      ["Takeaways", count("takeaway")], ["Turnovers", count("turnover")],
      ["Blocked shots", count("block", "blocked_shot")], ["Passes", count("pass")],
      ["Body checks", count("body_check")], ["Penalties", count("penalty")],
      ["Icings", count("icing")], ["Offsides", count("offside")],
      ["Possession exits", count("exit_possession")], ["Clears", count("clear")],
      ["Failed exits", count("failed_exit")], ["1-on-1 wins", count("one_on_one_win")],
      ["1-on-1 stops", count("one_on_one_stop")], ["Beaten on defense", count("burned", "one_on_one_beaten")],
    ] as [string, number][],
  };
}

// Only web URLs become clickable. Accept older single links and newer link arrays.
export function videoLinks(record: { video_url?: string; video_links?: unknown }): { url: string; title: string }[] {
  const values: unknown[] = [record.video_url, ...(Array.isArray(record.video_links) ? record.video_links : [])];
  const seen = new Set<string>();
  return values.flatMap(value => {
    const item = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
    const url = typeof value === "string" ? value : item.url ?? item.video_url;
    if (typeof url !== "string") return [];
    try {
      const parsed = new URL(url);
      if (!["https:", "http:"].includes(parsed.protocol) || seen.has(parsed.href)) return [];
      seen.add(parsed.href);
      return [{ url: parsed.href, title: typeof item.title === "string" ? item.title : "Watch video" }];
    } catch { return []; }
  });
}
