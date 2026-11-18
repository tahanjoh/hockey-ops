'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MediaFields from './MediaFields';
import type { Showcase } from '@/lib/hockey/showcase';
import type { LeagueLink } from '@/lib/hockey/showcaseMedia';
import { showcasePath, type ShowcaseLink } from '@/lib/hockey/showcaseExtras';
import { saveShowcase } from './actions';
type Game = { id: string; opponent: string; date: string; clips: { key: string; label: string; title: string }[] };
export default function Editor({ id, token, games, initial, publicationId, initialTitle = '' }: { id: string; token: string | null; games: Game[]; initial: Showcase | null; publicationId?: string; initialTitle?: string }) {
  const router = useRouter();
  const [publishedId, setPublishedId] = useState(publicationId ?? '');
  const [link, setLink] = useState(token ? showcasePath(token) : '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [leagues, setLeagues] = useState<LeagueLink[]>(initial?.leagues ?? []);
  const [links, setLinks] = useState<ShowcaseLink[]>(initial?.links ?? []);
  const [processing, setProcessing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [clips, setClips] = useState<string[]>([]);
  return <form className="space-y-5" action={async form => {
    setBusy(true); setStatus('');
    try {
      const result = await saveShowcase(form);
      if (result.error) setStatus(result.error);
      else if (result.disabled) { setLink(''); setStatus('Sharing disabled for this showcase.'); router.refresh(); }
      else if (result.token) {
        setLink(showcasePath(result.token));
        if (result.publicationId) setPublishedId(result.publicationId);
        setStatus(form.get('action') === 'rotate' ? 'Link replaced for this showcase. Other showcases are unchanged.' : 'Showcase saved. Your earlier showcases are still available.');
        if (result.publicationId) router.replace(`/players/${id}/showcase?showcase=${result.publicationId}`, { scroll: false });
        router.refresh();
      }
    } catch { setStatus('Unable to save. Try again.'); } finally { setBusy(false); }
  }}>
    <input type="hidden" name="player" value={id} /><input type="hidden" name="publication" value={publishedId} />
    {link && <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-4">
      <p className="text-sm font-semibold">Share link</p><a className="mt-1 block break-all font-bold underline" href={link} target="_blank" rel="noopener noreferrer">{link} ↗</a>
      <button type="button" className="mt-3 rounded-lg border px-3 py-2 font-semibold" onClick={async () => { try { await navigator.clipboard.writeText(new URL(link, window.location.origin).href); setStatus('Link copied. Anyone with this link can view the showcase.'); } catch { setStatus('Open the showcase and copy its address.'); } }}>Copy link</button>
    </div>}
    <p className="text-sm text-gray-500">Each publication is saved separately. Give it a name, select games, and publish a new showcase. Earlier showcases keep their own links. Replace link and Disable sharing affect only the selected saved showcase. Selecting a game includes its clips unless you uncheck them.</p>
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      <label className="block font-semibold">Showcase name<input name="title" defaultValue={initialTitle} maxLength={120} required className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="November tournament weekend" /><span className="mt-1 block text-sm font-normal text-gray-500">Used in your saved-showcase list.</span></label>
      <div className="grid grid-cols-2 gap-3">{[['team', 'Team'], ['jersey', 'Jersey number'], ['position', 'Position'], ['graduation', 'Graduation year']].map(([name, label]) => <label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={initial?.[name as 'team' | 'jersey' | 'position' | 'graduation'] ?? ''} maxLength={name === 'team' ? 80 : name === 'position' ? 40 : name === 'graduation' ? 4 : 8} className="mt-1 w-full rounded-lg border bg-transparent p-3" /></label>)}</div>
      <label className="block font-semibold">Player introduction<textarea defaultValue={initial?.bio ?? ''} name="bio" maxLength={500} className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="What makes this player stand out?" /></label>
      <label className="block font-semibold">Showcase message<textarea defaultValue={initial?.message ?? ''} name="message" maxLength={1500} rows={4} className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="Here are the results from my tournament this weekend." /><span className="mt-1 block text-sm font-normal text-gray-500">An optional update displayed below the player introduction.</span></label>
      <fieldset className="rounded-2xl border p-4"><legend className="px-2 text-xl font-bold">More links</legend><p className="mb-3 text-sm text-gray-500">Add Taylor’s YouTube channel, a tournament reel, a team page, or other links.</p>
        <input type="hidden" name="links" value={JSON.stringify(links)} />
        <div className="space-y-3">{links.map((item, index) => <div key={index} className="space-y-2 rounded-xl border p-3">
          <label className="block text-sm font-semibold">Link title<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={item.title} maxLength={80} placeholder="Taylor’s YouTube channel" onChange={event => setLinks(links.map((row, i) => i === index ? { ...row, title: event.target.value } : row))} /></label>
          <label className="block text-sm font-semibold">Link address<input className="mt-1 w-full rounded-lg border bg-transparent p-2" type="url" value={item.url} maxLength={2000} placeholder="https://…" onChange={event => setLinks(links.map((row, i) => i === index ? { ...row, url: event.target.value } : row))} /></label>
          <button type="button" className="text-sm underline" onClick={() => setLinks(links.filter((_, i) => i !== index))}>Remove link {index + 1}</button>
        </div>)}</div>
        <button type="button" disabled={links.length >= 8} className="mt-3 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50" onClick={() => setLinks([...links, { title: '', url: '' }])}>+ Add link</button>
      </fieldset>
      <MediaFields images={images} setImages={setImages} leagues={leagues} setLeagues={setLeagues} onProcessing={setProcessing} />
      <fieldset><legend className="text-xl font-bold">Games and highlights</legend><p className="mb-3 text-sm text-gray-500">Only selected games and checked videos are public. Private notes and evaluations stay private.</p>
        {!games.length && <p>No completed games yet.</p>}
        {games.map(game => <div key={game.id} className="mb-3 rounded-xl border p-4"><label className="font-bold"><input type="checkbox" name="game" value={game.id} checked={selected.includes(game.id)} onChange={event => {
          const checked = event.target.checked;
          setSelected(checked ? [...selected, game.id] : selected.filter(x => x !== game.id));
          const keys = game.clips.map(clip => clip.key);
          setClips(current => checked ? [...new Set([...current, ...keys])] : current.filter(key => !keys.includes(key)));
        }} /> {game.date} · vs {game.opponent}</label>
          <div className="mt-2 space-y-2 pl-4">{game.clips.map(clip => <label key={clip.key} className="block text-sm"><input type="checkbox" name="clip" value={clip.key} checked={clips.includes(clip.key)} disabled={!selected.includes(game.id)} onChange={event => setClips(current => event.target.checked ? [...current, clip.key] : current.filter(key => key !== clip.key))} /> <span className="capitalize">{clip.label}</span> · {clip.title}</label>)}</div>
        </div>)}
      </fieldset>
      <div className="flex flex-wrap gap-3"><button disabled={busy || processing} name="action" value="publish" className="rounded-xl bg-sky-800 px-5 py-3 font-bold text-white">{busy ? 'Saving…' : 'Publish new showcase'}</button><button disabled={busy || !link} name="action" value="rotate" formNoValidate className="rounded-xl border px-4 py-3">Replace link</button><button disabled={busy || !link} name="action" value="disable" formNoValidate className="rounded-xl border px-4 py-3">Disable sharing</button></div>
    </fieldset>
    <p role="status">{status}</p>
  </form>;
}
