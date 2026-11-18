import Link from 'next/link';
import type { Showcase, ShowcaseGame, PublicClip } from '@/lib/hockey/showcase';
export default function PublicGame({ data, game, basePath }: { data: Showcase; game: ShowcaseGame & { clips: PublicClip[] }; basePath: string }) {
  return <main className="min-h-screen bg-[#06152d] px-5 py-10 text-white"><div className="mx-auto max-w-3xl">
    <Link className="font-semibold text-cyan-300" href={basePath}>← {data.name} · Player Showcase</Link>
    <p className="mt-8 text-xs font-bold uppercase tracking-[.3em] text-cyan-300">Game spotlight</p><h1 className="mt-3 text-4xl font-black">vs {game.opponent}</h1><p className="mt-3 text-slate-300">{game.date}</p>
    {game.teamScore != null && game.opponentScore != null && <p className="mt-5 text-xl font-bold">Final score: {game.teamScore} – {game.opponentScore}</p>}
    <section aria-label="Game stats" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Goals',game.goals],['Assists',game.assists],...(game.sog != null ? [['Shots on goal',game.sog]] : []),...(game.plusMinus != null ? [['+/−',game.plusMinus]] : [])].map(([label,value]) => <div key={label} className="rounded-2xl border border-white/15 bg-white/5 p-5 text-center"><p className="text-3xl font-black text-cyan-300">{value ?? '—'}</p><p className="mt-2 text-sm">{label}</p></div>)}</section>
    <h2 className="mt-10 text-2xl font-black">Game videos & highlights</h2><p className="mt-2 text-sm text-slate-400">Videos selected for this shared showcase.</p>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">{game.clips.map((clip,index) => <a key={index} href={clip.url} target="_blank" rel="noopener noreferrer" className="rounded-2xl border border-white/15 bg-white/5 p-6 hover:border-cyan-300"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-300 text-slate-950">▶</span><h3 className="mt-4 text-lg font-bold">{clip.title === 'Watch video' ? clip.label || 'Watch play' : clip.title}</h3><p className="mt-2 text-sm capitalize text-slate-300">{clip.label}{clip.period ? ` · ${clip.period === 4 ? 'OT' : `P${clip.period}`}` : ''}{clip.clock ? ` · Clock ${clip.clock}` : ''}</p><p className="mt-4 font-semibold text-cyan-300">Watch video ↗</p></a>)}</div>
    {!game.clips.length && <p className="mt-5 rounded-2xl border border-white/15 p-5 text-slate-300">No video clips were included for this game.</p>}
  </div></main>;
}
