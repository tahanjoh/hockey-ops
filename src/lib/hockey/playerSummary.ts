import { calculateGameImpact } from "./gameImpact";

export type SummaryEvent = { id?: string; event_type: string; period?: number; video_url?: string; video_links?: unknown; note_text?: string };
export type SummaryGame = { id: string; opponent: string; game_date: string; position: string; team_score: number | null; opponent_score: number | null; game_events: SummaryEvent[]; video_url?: string; video_links?: unknown };

export function summarizeGames(games: SummaryGame[]) {
  const events = games.flatMap(game => game.game_events ?? []);
  const count = (...types: string[]) => events.filter(event => types.includes(event.event_type)).length;
  const goals = count("goal");
  const assists = count("assist");
  const shots = count("shot", "missed_shot", "sog", "goal");
  const sog = count("sog", "goal");
  const scoredGames = games.filter(game => game.team_score !== null && game.opponent_score !== null);
  return {
    games: games.length, goals, assists, points: goals + assists, shots, sog,
    shooting: sog ? goals / sog * 100 : null,
    averageImpact: games.length ? games.reduce((sum, game) => sum + calculateGameImpact(game.position === "defense" ? "defense" : "forward", game.game_events ?? []).gameImpact, 0) / games.length : null,
    wins: scoredGames.filter(game => game.team_score! > game.opponent_score!).length,
    losses: scoredGames.filter(game => game.team_score! < game.opponent_score!).length,
    ties: scoredGames.filter(game => game.team_score === game.opponent_score).length,
    details: [
      ["On-ice goals for", count("goal_for", "goal", "assist")],
      ["On-ice goals against", count("goal_against")],
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
