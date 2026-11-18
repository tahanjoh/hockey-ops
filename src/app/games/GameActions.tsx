'use client';
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { deleteGameRecord } from './gameRecordActions';

export default function GameActions({ gameId, playerId, opponent }: { gameId: string; playerId: string; opponent: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [state, action, pending] = useActionState(deleteGameRecord.bind(null, gameId, playerId), { error: '' });
  return <div className="mt-4 border-t pt-3">
    <div className="flex gap-3">
      <Link href={`/games/${gameId}/edit`} className="flex-1 rounded-xl border px-3 py-3 text-center font-semibold">Edit Game</Link>
      <button type="button" aria-expanded={confirming} onClick={() => { setConfirmation(''); setConfirming(value => !value); }} disabled={pending} className="flex-1 rounded-xl border border-red-500 px-3 py-3 font-semibold text-red-500">Delete Game</button>
    </div>
    {confirming && <form action={action} className="mt-3 space-y-3 rounded-xl border border-red-500 p-4">
      <p className="font-bold">Delete game vs {opponent}?</p>
      <p className="text-sm">This permanently removes the game, its recorded stats, shifts, and saved highlight links. Videos on YouTube are unaffected.</p>
      <label className="block text-sm font-semibold">Type DELETE to confirm<input name="confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoFocus disabled={pending} className="mt-2 block w-full rounded-lg border bg-transparent px-3 py-3" /></label>
      {state.error && <p role="alert" className="text-sm text-red-500">{state.error}</p>}
      <div className="flex gap-3"><button disabled={pending} type="button" className="flex-1 rounded-lg border px-3 py-3 font-semibold" onClick={() => { setConfirming(false); setConfirmation(''); }}>Cancel</button><button type="submit" disabled={pending || confirmation !== 'DELETE'} className="flex-1 rounded-lg bg-red-700 px-3 py-3 font-semibold text-white disabled:opacity-40">{pending ? 'Deleting…' : 'Delete Permanently'}</button></div>
    </form>}
  </div>;
}
