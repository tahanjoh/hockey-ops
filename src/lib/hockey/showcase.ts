import type { ShowcaseMedia } from './showcaseMedia';
import { videoLinks, type SummaryGame } from './playerSummary';
export type Showcase = Partial<ShowcaseMedia> & { name: string; team: string; jersey: string; position: string; graduation: string; bio: string; updated: string; games: { opponent: string; date: string; goals: number; assists: number; sog: number }[]; clips: { url: string; title: string; opponent: string; date: string }[] };
export function showcaseClips(game: SummaryGame) {
 return [...videoLinks(game).map(link => ({ ...link, label: 'Game video' })), ...(game.game_events ?? []).flatMap(event => videoLinks(event).map(link => ({ ...link, label: event.event_type.replaceAll('_',' ') })))].map((clip, index) => ({ ...clip, key: `${game.id}:${index}`, opponent: game.opponent, date: game.game_date }));
}
export function buildShowcase(name: string, games: SummaryGame[], selected: Set<string>, profile: Pick<Showcase,'team'|'jersey'|'position'|'graduation'|'bio'|'images'|'leagues'>): Showcase {
 return { name, ...profile, updated: new Date().toISOString(), games: games.map(game => { const count = (...types: string[]) => game.game_events.filter(e => types.includes(e.event_type)).length; return { opponent: game.opponent, date: game.game_date, goals: count('goal'), assists: count('assist'), sog: count('sog','goal') }; }), clips: games.flatMap(showcaseClips).filter(clip => selected.has(clip.key)).map(({url,title,opponent,date}) => ({url,title,opponent,date})) };
}
