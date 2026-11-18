'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function deleteGameRecord(gameId: string, playerId: string, _state: { error: string }, form: FormData) {
  if (form.get('confirmation') !== 'DELETE') return { error: 'Type DELETE to confirm removing this game.' };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again before deleting a game.' };
  const { data: allowed, error: accessError } = await supabase.rpc('hockey_is_parent', { p_player: playerId });
  if (accessError || !allowed) return { error: 'You do not have permission to delete this game.' };
  // The delete is a single database operation; related rows follow existing FK rules.
  // Returning the row detects missing games and RLS denial rather than reporting false success.
  const { data: deleted, error } = await supabase.from('games').delete().eq('id', gameId).eq('player_id', playerId).select('id').maybeSingle();
  if (error) return { error: 'The game could not be deleted. ' + error.message };
  if (!deleted) return { error: 'The game was not found or your access has changed. Refresh Game History.' };
  revalidatePath('/');
  revalidatePath(`/players/${playerId}/games`);
  revalidatePath(`/players/${playerId}/summary`);
  revalidatePath(`/players/${playerId}/showcase`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/results`);
  redirect(`/players/${playerId}/games`);
}
