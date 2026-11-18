'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MediaFields from './MediaFields';
import type { Showcase } from '@/lib/hockey/showcase';
import type { LeagueLink } from '@/lib/hockey/showcaseMedia';
import { type ShowcaseLink } from '@/lib/hockey/showcaseExtras';
import { saveShowcase } from './createShowcaseActions';
import { restoreShowcaseSelection, type EditorGame, type ShowcaseSelection } from '@/lib/hockey/showcaseEditing';
export default function CreateShowcaseForm({ id, games, initial, initialTitle = '', fromSaved = false, publicationId, initialSelection, version }: { id: string; games: EditorGame[]; initial: Showcase | null; initialTitle?: string; fromSaved?: boolean; publicationId?: string; initialSelection?: ShowcaseSelection | null; version?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [images, setImages] = useState<string[]>(initial?.images ?? []);
  const [leagues, setLeagues] = useState<LeagueLink[]>(initial?.leagues ?? []);
  const [links, setLinks] = useState<ShowcaseLink[]>(initial?.links ?? []);
  const [processing, setProcessing] = useState(false);
  const restored = restoreShowcaseSelection(games,initial,initialSelection);
  const [selected, setSelected] = useState<string[]>(restored.games);
  const [clips, setClips] = useState<string[]>(restored.clips);
  const [selectionChanged, setSelectionChanged] = useState(false);
  return <form className="space-y-5" action={async form => {
    setBusy(true); setStatus('');
    try {
      const result = await saveShowcase(form);
      if (result.error) setStatus(result.error);
      else if (result.publicationId) {
        setStatus(form.get('action') === 'update' ? 'Changes saved. The showcase link is unchanged.' : 'New showcase created.');
        router.replace(`/players/${id}/showcase`, { scroll: true });
        router.refresh();
      }
    } catch { setStatus('Unable to save. Try again.'); } finally { setBusy(false); }
  }}>
    <input type="hidden" name="player" value={id} /><input type="hidden" name="publication" value={publicationId ?? ''} /><input type="hidden" name="version" value={version ?? ''} /><input type="hidden" name="selection_changed" value={String(selectionChanged)} />
    <p className="text-sm text-gray-500">{fromSaved ? 'Edit this showcase and save changes to keep the same share link. Use Save As New Showcase to create a separate copy.' : 'Name this showcase, add a custom note, and select the games and clips to share.'}</p>
    <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
      <label className="block font-semibold">Showcase title<input name="title" defaultValue={initialTitle} maxLength={120} required className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="November tournament weekend" /><span className="mt-1 block text-sm font-normal text-gray-500">Used in your saved-showcase list.</span></label>
      <label className="block font-semibold">Custom note<textarea defaultValue={initial?.message ?? ''} name="message" maxLength={1500} rows={4} className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="Here are the results from my tournament this weekend." /><span className="mt-1 block text-sm font-normal text-gray-500">Optional. Appears on this showcase below the player introduction.</span></label>
      <div className="grid grid-cols-2 gap-3">{[['team', 'Team'], ['jersey', 'Jersey number'], ['position', 'Position'], ['graduation', 'Graduation year']].map(([name, label]) => <label key={name} className="text-sm font-semibold">{label}<input name={name} defaultValue={initial?.[name as 'team' | 'jersey' | 'position' | 'graduation'] ?? ''} maxLength={name === 'team' ? 80 : name === 'position' ? 40 : name === 'graduation' ? 4 : 8} className="mt-1 w-full rounded-lg border bg-transparent p-3" /></label>)}</div>
      <label className="block font-semibold">Player introduction<textarea defaultValue={initial?.bio ?? ''} name="bio" maxLength={500} className="mt-1 w-full rounded-lg border bg-transparent p-3" placeholder="What makes this player stand out?" /></label>
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
      <fieldset><legend className="text-xl font-bold">Games and highlights</legend>{fromSaved && restored.missing && <p className="mb-3 rounded-xl border p-3 text-sm">Some original game records or clips have changed or are unavailable. The published games and clips will be preserved unless you change the selections below.</p>}<p className="mb-3 text-sm text-gray-500">Only selected games and checked videos are public. Private notes and evaluations stay private.</p>
        {!games.length && <p>No completed games yet.</p>}
        {games.map(game => <div key={game.id} className="mb-3 rounded-xl border p-4"><label className="font-bold"><input type="checkbox" name="game" value={game.id} checked={selected.includes(game.id)} onChange={event => {
          setSelectionChanged(true);
          const checked = event.target.checked;
          setSelected(checked ? [...selected, game.id] : selected.filter(x => x !== game.id));
          const keys = game.clips.map(clip => clip.key);
          setClips(current => checked ? [...new Set([...current, ...keys])] : current.filter(key => !keys.includes(key)));
        }} /> {game.date} · vs {game.opponent}</label>
          <div className="mt-2 space-y-2 pl-4">{game.clips.map(clip => <label key={clip.key} className="block text-sm"><input type="checkbox" name="clip" value={clip.key} checked={clips.includes(clip.key)} disabled={!selected.includes(game.id)} onChange={event => { setSelectionChanged(true); setClips(current => event.target.checked ? [...current, clip.key] : current.filter(key => key !== clip.key)); }} /> <span className="capitalize">{clip.label}</span> · {clip.title}</label>)}</div>
        </div>)}
      </fieldset>
      <div className="flex flex-wrap gap-3"><button disabled={busy || processing} name="action" value={fromSaved ? 'update' : 'publish'} className="flex-1 rounded-xl bg-sky-800 px-5 py-4 text-lg font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : fromSaved ? 'Save Changes' : 'Create Showcase'}</button>{fromSaved && <button disabled={busy || processing} name="action" value="publish" className="rounded-xl border px-5 py-4 font-semibold">Save As New Showcase</button>}</div>
    </fieldset>
    <p role="status">{status}</p>
  </form>;
}
