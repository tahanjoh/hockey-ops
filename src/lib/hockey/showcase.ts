import { showcaseGameStats, type TrackedGameStats, type ShowcaseSourceGame } from './showcaseGameStats';
import type { ShowcaseMedia } from './showcaseMedia';
import type { ShowcaseLink } from './showcaseExtras';
import { videoLinks, type SummaryGame } from './playerSummary';
export type PublicClip = { url: string; title: string; opponent: string; date: string; label?: string; period?: number; clock?: string; gameKey?: string };
export type ShowcaseGame = { trackingMode?: 'live' | 'manual'; trackedStats?: TrackedGameStats; key?: string; opponent: string; date: string; goals: number | null; assists: number | null; sog: number | null; plusMinus?: number | null; teamScore?: number | null; opponentScore?: number | null; clips?: PublicClip[] };
export type Showcase = Partial<ShowcaseMedia> & { name: string; team: string; jersey: string; position: string; graduation: string; bio: string; updated: string; message?: string; links?: ShowcaseLink[]; games: ShowcaseGame[]; clips: PublicClip[] };
export function showcaseClips(game: SummaryGame) {
  return [
    ...videoLinks(game).map(link => ({ ...link, label: 'Game video', period: undefined as number | undefined, clock: undefined as string | undefined })),
    ...(game.game_events ?? []).flatMap(event => videoLinks(event).map(link => ({ ...link, label: event.event_type.replaceAll('_', ' '), period: event.period ?? undefined, clock: event.clock_time ?? undefined }))),
  ].map((clip, index) => ({ ...clip, key: `${game.id}:${index}`, opponent: game.opponent, date: game.game_date }));
}
export function buildShowcase(name: string, games: ShowcaseSourceGame[], selected: Set<string>, profile: Pick<Showcase, 'team' | 'jersey' | 'position' | 'graduation' | 'bio' | 'images' | 'leagues'> & Partial<Pick<Showcase, 'message' | 'links'>>): Showcase {
  const shared = games.map((game, index): ShowcaseGame => {
    const key = String(index + 1);
    const count = (...types: string[]) => (game.game_events ?? []).filter(e => types.includes(e.event_type)).length;
    const manual = game.entry_mode === 'manual';
    const clips = showcaseClips(game).filter(clip => selected.has(clip.key)).map(({ url, title, opponent, date, label, period, clock }) => ({ url, title, opponent, date, label, period, clock, gameKey: key }));
    return { key, trackingMode: manual ? 'manual' : 'live', trackedStats: showcaseGameStats(game), opponent: game.opponent, date: game.game_date,
      goals: manual ? game.manual_stats?.goals ?? null : count('goal'),
      assists: manual ? game.manual_stats?.assists ?? null : count('assist'),
      sog: manual ? null : count('sog', 'goal'),
      plusMinus: manual ? game.manual_stats?.plus_minus ?? null : undefined,
      teamScore: game.team_score, opponentScore: game.opponent_score, clips };
  });
  // Copy only deliberately public fields. Never copy whole game/event records or private notes.
  return { name, ...profile, updated: new Date().toISOString(), games: shared, clips: shared.flatMap(game => game.clips ?? []) };
}
export function publicGame(data: Showcase, key: string) {
  if (!/^[1-9]\d{0,2}$/.test(key)) return null;
  const index = Number(key) - 1;
  const game = data.games[index];
  if (!game) return null;
  // Older snapshots have no per-game clips. Match their already-public reel by game.
  const clips = game.clips ?? data.clips.filter(clip => clip.opponent === game.opponent && clip.date === game.date);
  return { ...game, clips };
}

// Only matched games from the parent-authorized source query may enrich a snapshot.
// Keep its original clip selections and ordering, even when refreshing tracked stats.
export function refreshShowcaseGameStats(snapshot: Showcase, sources: ShowcaseSourceGame[]): Showcase {
  return {...snapshot,games:snapshot.games.map(published => {
    const matches = sources.filter(source => source.opponent === published.opponent && source.game_date === published.date);
    if(matches.length !== 1) return published;
    const source = matches[0];
    const updated = buildShowcase(snapshot.name,[source],new Set(),snapshot).games[0];
    return {...updated,key:published.key,clips:published.clips};
  })};
}
