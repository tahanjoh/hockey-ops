'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { parseManualGame } from '@/lib/hockey/manualGame';
export async function saveManualGame(playerId: string, gameId: string | null, _state: { error: string }, form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again before saving.' };
  let payload;
  try { payload = parseManualGame(form); } catch (error) { return { error: error instanceof Error ? error.message : 'Check the game details.' }; }
  const { data, error } = await supabase.rpc('hockey_save_manual_game', { p_player: playerId, p_game: gameId, p_data: payload });
  if (error) return { error: error.message.includes('hockey_save_manual_game') ? 'The Add Game database update needs to be applied before saving.' : error.message };
  revalidatePath('/');
  revalidatePath(`/players/${playerId}/summary`);
  revalidatePath(`/players/${playerId}/games`);
  revalidatePath(`/games/${data}/results`);
  redirect(`/games/${data}/results`);
}
