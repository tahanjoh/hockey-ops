import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { showcaseClips, type Showcase } from '@/lib/hockey/showcase';
import type { SummaryGame } from '@/lib/hockey/playerSummary';
import type { ShowcaseSelection } from '@/lib/hockey/showcaseEditing';
import type { SavedShowcase } from '@/lib/hockey/savedShowcases';
import CreateShowcaseForm from './CreateShowcaseForm';
import SavedShowcaseControls from './SavedShowcaseControls';
import SavedShowcases from './SavedShowcases';
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ showcase?: string; new?: string }> }) {
  const { id } = await params;
  const filters = await searchParams;
  const showFields = filters.new === '1' || !!filters.showcase;
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect('/login');
  const { data: parent } = await db.rpc('hockey_is_parent', { p_player: id });
  if (!parent) redirect('/');
  const [{ data: player }, { data: games, error }, { data: entries, error: setupError }] = await Promise.all([
    db.from('players').select('first_name,last_name').eq('id',id).single(),
    showFields ? db.from('games').select('*,game_events(*)').eq('player_id',id).eq('status','completed').order('game_date',{ascending:false}) : Promise.resolve({ data: [], error: null }),
    db.rpc('hockey_showcases_list',{p_player:id}),
  ]);
  if (error) throw new Error(error.message);
  const items = (entries ?? []) as SavedShowcase[];
  const chosen = filters.showcase ? items.find(item => item.id === filters.showcase) : undefined;
  if (!setupError && filters.showcase && !chosen) notFound();
  let snapshot: Showcase | null = null;
  let selection: ShowcaseSelection | null = null;
  let version: string | undefined;
  if (chosen) {
    const { data, error: loadError } = await db.rpc('hockey_showcase_publication_manage',{p_player:id,p_action:'get',p_publication:chosen.id});
    if (loadError) throw new Error('Unable to load the saved showcase. Refresh and try again.');
    snapshot = data.snapshot as Showcase;
    selection = data.selection;
    version = data.updated_at;
  }
  return <main className="mx-auto max-w-3xl p-5">
    <Link href={showFields ? `/players/${id}/showcase` : `/players/${id}/summary`} className="underline">← {showFields ? 'Saved Showcases' : 'Player Summary'}</Link>
    <h1 className="mt-6 text-3xl font-black">{showFields ? chosen ? 'Edit Showcase' : 'Create Showcase' : 'Player showcases'}</h1>
    <p className="mt-3 text-gray-500">{showFields ? `For ${player?.first_name} ${player?.last_name}.` : `Choose a saved showcase or create a new one for ${player?.first_name} ${player?.last_name}.`}</p>
    {setupError ? <p role="alert" className="mt-5 rounded-xl border p-4">Apply the Saved Showcases database migration before using this page.</p> : !showFields ? (
      <SavedShowcases playerId={id} items={items} />
    ) : <div className="mt-7">
      {chosen && <SavedShowcaseControls key={chosen.id} playerId={id} item={chosen} />}
      <section id="create-showcase" aria-label={chosen ? 'Showcase fields' : 'Create Showcase'} className="rounded-2xl border p-5 sm:p-6">
        {chosen && <h2 className="mb-3 text-xl font-bold">Showcase fields</h2>}
        <CreateShowcaseForm key={chosen?.id ?? 'new'} id={id} initial={snapshot} initialTitle={chosen?.title} fromSaved={!!chosen} publicationId={chosen?.id} initialSelection={selection} version={version} games={((games ?? []) as SummaryGame[]).map(game => ({id:game.id,opponent:game.opponent,date:game.game_date,clips:showcaseClips(game)}))} />
      </section>
    </div>}
  </main>;
}
