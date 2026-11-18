'use client';
import Link from 'next/link';
import DeleteShowcase from './DeleteShowcase';
import { useState } from 'react';
import { showcasePath } from '@/lib/hockey/showcaseExtras';
import type { SavedShowcase } from '@/lib/hockey/savedShowcases';
export default function SavedShowcases({ playerId, items, selected }: { playerId: string; items: SavedShowcase[]; selected?: string }) {
  const [message, setMessage] = useState('');
  return <section className="my-7" aria-label="Saved showcases">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">Saved showcases <span className="text-base font-normal">({items.length})</span></h2><Link href={`/players/${playerId}/showcase?new=1#create-showcase`} className="rounded-xl bg-sky-800 px-4 py-3 font-semibold text-white">+ Create New Showcase</Link></div>
    {!items.length && <p className="mt-4 rounded-xl border p-4 text-gray-500">Your published showcases will appear here.</p>}
    <div className="mt-4 space-y-3">{items.map(item => <article key={item.id} className={`rounded-2xl border p-4 ${selected === item.id ? 'border-cyan-500 bg-cyan-500/5' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold">{item.title}</h3><p className="mt-1 text-sm text-gray-500">{item.created_at.slice(0,10)} · {item.games} game{item.games === 1 ? '' : 's'}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.enabled ? 'text-cyan-600' : 'text-gray-500'}`}>{item.enabled ? 'Available' : 'Sharing disabled'}</span></div>
      <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
        {item.enabled && <><a href={showcasePath(item.code)} target="_blank" rel="noopener noreferrer" className="rounded-lg border px-3 py-2">Open showcase ↗</a><button type="button" className="rounded-lg border px-3 py-2" onClick={async () => { try { await navigator.clipboard.writeText(new URL(showcasePath(item.code),window.location.origin).href); setMessage(`Link copied for ${item.title}.`); } catch { setMessage('Open the showcase and copy its address.'); } }}>Copy link</button></>}
        <Link href={`/players/${playerId}/showcase?showcase=${item.id}#saved-showcase`} className="rounded-lg border px-3 py-2">Edit Showcase</Link>
      </div>
      <DeleteShowcase playerId={playerId} publicationId={item.id} title={item.title} />
    </article>)}</div><p role="status" className="mt-3 text-sm">{message}</p>
  </section>;
}
