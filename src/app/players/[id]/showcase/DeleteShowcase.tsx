'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteShowcase } from './deleteShowcaseActions';
export default function DeleteShowcase({ playerId, publicationId, title }: { playerId: string; publicationId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  return <div className="mt-3">
    <button type="button" disabled={pending} aria-expanded={open} onClick={() => { setOpen(!open); setConfirmation(''); setError(''); }} className="rounded-lg border border-red-500 px-3 py-2 text-sm font-semibold text-red-600">Delete Showcase</button>
    {open && <form className="mt-3 space-y-3 rounded-xl border border-red-500 p-4" action={async () => {
      setPending(true); setError('');
      try {
        const result = await deleteShowcase(playerId,publicationId,confirmation);
        if (result.error) setError(result.error);
        else if (result.deleted) { router.replace(`/players/${playerId}/showcase`); router.refresh(); }
      } catch { setError('Unable to delete this showcase. Try again.'); }
      finally { setPending(false); }
    }}>
      <p className="font-bold">Delete “{title}”?</p>
      <p className="text-sm">This removes the saved showcase and stops its share links from working. Your original games, stats, and YouTube videos are kept.</p>
      <label className="block text-sm font-semibold">Type DELETE to confirm<input disabled={pending} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" className="mt-2 block w-full rounded-lg border bg-transparent px-3 py-3" /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={pending} onClick={() => { setOpen(false); setConfirmation(''); setError(''); }} className="rounded-lg border px-4 py-2">Cancel</button><button type="submit" disabled={pending || confirmation !== 'DELETE'} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-40">{pending ? 'Deleting…' : 'Delete Permanently'}</button></div>
    </form>}
  </div>;
}
