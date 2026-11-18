import GameActions from "../GameActions";
import Link from 'next/link';
import type { ManualStats } from '@/lib/hockey/manualGame';
import { videoLinks } from '@/lib/hockey/playerSummary';
export default function ManualResults({ game, events, name }: { game: { id: string; player_id: string; opponent: string; game_date: string; team_score: number | null; opponent_score: number | null; manual_stats: ManualStats }; events: { id: string; event_type: string; period: number | null; clock_time: string | null; video_url?: string | null }[]; name: string }) {
  const stats = game.manual_stats;
  return <main className="mx-auto min-h-screen max-w-lg bg-slate-950 px-5 py-7 text-slate-100">
    <Link href={`/players/${game.player_id}/games`} className="text-cyan-300">← Game History</Link><p className="mt-6 text-xs uppercase tracking-widest text-cyan-300">Completed · Added Game</p><h1 className="mt-2 text-3xl font-bold">{name}</h1><p className="mt-2">vs {game.opponent} · {game.game_date}</p>
    <p className="mt-4 text-lg">Final score: {game.team_score ?? '—'} – {game.opponent_score ?? '—'}</p>
    <div className="mt-6 grid grid-cols-3 gap-3">{[['Goals',stats.goals],['Assists',stats.assists],['+/−',stats.plus_minus]].map(([label,value]) => <div key={label} className="rounded-xl border border-slate-600 p-4 text-center"><div className="text-2xl font-bold">{value ?? '—'}</div><div className="mt-1 text-sm">{label}</div></div>)}</div>
    <p className="mt-4 text-sm text-slate-300">Only entered stats are recorded. Impact, ice time, and other live metrics are unavailable.</p>
    <h2 className="mt-7 text-xl font-bold">Goals & assists</h2>
    <div className="mt-3 space-y-3">{events.map((event,index) => <article key={event.id} className="rounded-xl border border-slate-600 p-4"><h3 className="font-bold capitalize">{event.event_type} · Play {index+1}</h3><p className="mt-1 text-sm text-slate-300">{event.period ? event.period === 4 ? 'OT' : `P${event.period}` : 'Period not entered'}{event.clock_time ? ` · Clock ${event.clock_time}` : ''}</p>{videoLinks({video_url:event.video_url ?? undefined}).map(link => <a className="mt-2 inline-block font-semibold text-cyan-300" key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">Watch play ↗</a>)}</article>)}{!events.length && <p className="text-slate-300">No scoring plays entered yet.</p>}</div>
    <GameActions gameId={game.id} playerId={game.player_id} opponent={game.opponent} /><Link href={`/players/${game.player_id}/summary`} className="mt-3 block rounded-xl border border-slate-600 p-4 text-center">Player Summary</Link>
  </main>;
}
