import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import ManualGameForm, { type InitialGame } from './ManualGameForm';
export default async function AddGamePage({ searchParams }: { searchParams: Promise<{ player?: string; game?: string }> }) {
  const { player: playerId, game: gameId } = await searchParams;
  if (!playerId) redirect('/');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: player } = await supabase.from('players').select('id, first_name, last_name').eq('id',playerId).single();
  if (!player) redirect('/');
  let initial: InitialGame | undefined;
  let initialPlays = [];
  if (gameId) {
    const { data: game, error } = await supabase.from('games').select('*, game_events(*)').eq('id',gameId).eq('player_id',playerId).single();
    if (error || !game || game.entry_mode !== 'manual') redirect('/');
    initial = game as InitialGame;
    initialPlays = (game.game_events ?? []).filter((e: { event_type: string }) => ['goal','assist'].includes(e.event_type)).map((e: { id: string; event_type: 'goal' | 'assist'; period: number | null; clock_time: string | null; video_url: string | null }) => ({ id: e.id, event_type: e.event_type, period: e.period ? String(e.period) : '', clock_time: e.clock_time ?? '', video_url: e.video_url ?? '' }));
  }
  return <main className="mx-auto min-h-screen max-w-lg bg-slate-950 px-5 py-7 text-slate-100"><Link href={gameId ? `/games/${gameId}/results` : '/'} className="text-cyan-300">← {gameId ? 'Game results' : 'Players'}</Link><p className="mt-6 text-xs font-bold uppercase tracking-widest text-cyan-300">{gameId ? 'Edit Game' : 'Add Game'}</p><h1 className="mt-2 text-3xl font-bold">{player.first_name} {player.last_name}</h1><p className="mt-2 text-sm text-slate-300">Record a completed game and save highlights—even when you couldn’t watch live.</p><ManualGameForm playerId={playerId} initial={initial} initialPlays={initialPlays} /></main>;
}
