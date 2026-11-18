'use client';
import DeleteShowcase from './DeleteShowcase';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { showcasePath } from '@/lib/hockey/showcaseExtras';
import type { SavedShowcase } from '@/lib/hockey/savedShowcases';
import { saveShowcase } from './createShowcaseActions';
export default function SavedShowcaseControls({ playerId, item }: { playerId: string; item: SavedShowcase }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  return <section id="saved-showcase" aria-label="Selected saved showcase" className="mb-7 rounded-2xl border p-5">
    <p className="text-sm font-semibold text-gray-500">Selected saved showcase</p><h2 className="mt-1 text-xl font-bold">{item.title}</h2>
    <p className="mt-2 text-sm text-gray-500">Manage this link below, or edit the fields and save changes. Saving keeps the same link.</p>
    <div className="mt-4 flex flex-wrap gap-3">{item.enabled ? <><a className="rounded-lg border px-3 py-2 font-semibold" href={showcasePath(item.code)} target="_blank" rel="noopener noreferrer">Open showcase ↗</a><button type="button" className="rounded-lg border px-3 py-2 font-semibold" onClick={async () => { try { await navigator.clipboard.writeText(new URL(showcasePath(item.code),window.location.origin).href); setMessage('Link copied.'); } catch { setMessage('Open the showcase and copy its address.'); } }}>Copy link</button></> : <p className="font-semibold">Sharing is disabled for this showcase.</p>}</div>
    {item.enabled && <form className="mt-3 flex flex-wrap gap-3" action={async form => {
      setBusy(true); setMessage('');
      try { const result = await saveShowcase(form); if (result.error) setMessage(result.error); else { setMessage(result.disabled ? 'Sharing disabled.' : 'Link replaced. Other showcases are unchanged.'); router.refresh(); } }
      catch { setMessage('Unable to update this link. Try again.'); } finally { setBusy(false); }
    }}><input type="hidden" name="player" value={playerId}/><input type="hidden" name="publication" value={item.id}/><button disabled={busy} name="action" value="rotate" className="rounded-lg border px-3 py-2">Replace link</button><button disabled={busy} name="action" value="disable" className="rounded-lg border px-3 py-2">Disable sharing</button></form>}
    <DeleteShowcase playerId={playerId} publicationId={item.id} title={item.title} />
    <p role="status" className="mt-3 text-sm">{message}</p>
  </section>;
}
