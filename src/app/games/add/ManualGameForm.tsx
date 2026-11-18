'use client';
import { useActionState, useState } from 'react';
import { saveManualGame } from './actions';
import type { ManualPlay, ManualStats } from '@/lib/hockey/manualGame';
export type InitialGame = { id: string; opponent: string; game_date: string; position: string; home_away: string; game_type: string; team_score: number | null; opponent_score: number | null; manual_stats: ManualStats };
const input = 'mt-2 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-3 text-white';
export default function ManualGameForm({ playerId, initial, initialPlays = [] }: { playerId: string; initial?: InitialGame; initialPlays?: ManualPlay[] }) {
  const [plays, setPlays] = useState(initialPlays);
  const [state, action, pending] = useActionState(saveManualGame.bind(null, playerId, initial?.id ?? null), { error: '' });
  const change = (id: string, key: keyof ManualPlay, value: string) => setPlays(rows => rows.map(row => row.id === id ? { ...row, [key]: value } : row));
  const today = new Date().toLocaleDateString('en-CA');
  return <form action={action} className="mt-6 space-y-6">
    <fieldset disabled={pending} className="space-y-5 disabled:opacity-60">
      <section className="space-y-4 rounded-2xl border border-slate-600 p-4">
        <h2 className="text-lg font-bold">Game details</h2>
        <label className="block">Date<input aria-label="Game date" className={input} name="game_date" type="date" defaultValue={initial?.game_date ?? today} required /></label>
        <label className="block">Opponent<input className={input} name="opponent" defaultValue={initial?.opponent} maxLength={150} placeholder="Team name" required /></label>
        <div className="grid grid-cols-2 gap-3">
          <label>Position<select className={input} name="position" defaultValue={initial?.position ?? 'forward'}><option value="forward">Forward</option><option value="defense">Defense</option></select></label>
          <label>Location<select className={input} name="home_away" defaultValue={initial?.home_away ?? 'home'}><option value="home">Home</option><option value="away">Away</option></select></label>
        </div>
        <label className="block">Game type<select className={input} name="game_type" defaultValue={initial?.game_type ?? 'regular'}><option value="regular">Regular</option><option value="tournament">Tournament</option></select></label>
        <div className="grid grid-cols-2 gap-3">{[['team_score','Team score'],['opponent_score','Opponent score']].map(([name,label]) => <label key={name}>{label}<input className={input} type="number" name={name} min={0} max={99} defaultValue={initial?.[name as 'team_score' | 'opponent_score'] ?? ''} placeholder="Optional" /></label>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-600 p-4">
        <h2 className="text-lg font-bold">Player stats</h2><p className="mt-1 text-sm text-slate-300">Leave unknown stats blank. Enter 0 when confirmed.</p>
        <div className="mt-4 grid grid-cols-3 gap-3">{[['goals','Goals'],['assists','Assists'],['plus_minus','+/−']].map(([name,label]) => <label key={name}>{label}<input className={input} type="number" name={name} min={name === 'plus_minus' ? -99 : 0} max={99} defaultValue={initial?.manual_stats?.[name as keyof ManualStats] ?? ''} placeholder="—" /></label>)}</div>
      </section>
      <section className="rounded-2xl border border-slate-600 p-4">
        <h2 className="text-lg font-bold">Goals & assists</h2><p className="mt-1 text-sm text-slate-300">Add details for any of the totals above. Period, clock, and video are optional. These entries do not add to your totals.</p>
        {plays.map((play,index) => <fieldset key={play.id} className="mt-4 space-y-3 rounded-xl border border-slate-600 p-3">
          <legend className="px-2 font-semibold">{play.event_type === 'goal' ? 'Goal' : 'Assist'} · Highlight {index + 1}</legend>
          <div className="grid grid-cols-2 gap-3"><label>Period<select className={input} value={play.period} onChange={e => change(play.id,'period',e.target.value)}><option value="">Unknown</option>{[1,2,3,4].map(p => <option key={p} value={p}>{p === 4 ? 'OT' : `Period ${p}`}</option>)}</select></label><label>Clock remaining<input className={input} value={play.clock_time} placeholder="8:42" maxLength={5} onChange={e => change(play.id,'clock_time',e.target.value)} /></label></div>
          <label className="block">Video link<input className={input} type="url" value={play.video_url} placeholder="https://youtu.be/…" onChange={e => change(play.id,'video_url',e.target.value)} /></label>
          <button type="button" className="text-sm text-cyan-300 underline" onClick={() => setPlays(rows => rows.filter(r => r.id !== play.id))}>Remove highlight {index + 1}</button>
        </fieldset>)}
        <div className="mt-4 grid grid-cols-2 gap-3">{(['goal','assist'] as const).map(type => <button type="button" key={type} className="rounded-xl border border-cyan-400 px-3 py-3 font-semibold text-cyan-200" onClick={() => setPlays(rows => [...rows,{ id: crypto.randomUUID(), event_type: type, period: '', clock_time: '', video_url: '' }])}>+ Add {type}</button>)}</div>
      </section>
      <input type="hidden" name="plays" value={JSON.stringify(plays)} />
      {state.error && <p role="alert" className="rounded-xl border border-red-400 p-3 text-red-200">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-xl bg-cyan-300 px-4 py-4 font-bold text-slate-950">{pending ? 'Saving…' : initial ? 'Save Changes' : 'Save Completed Game'}</button>
    </fieldset>
  </form>;
}
