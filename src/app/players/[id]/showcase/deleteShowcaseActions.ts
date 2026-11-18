'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
export async function deleteShowcase(playerId: string, publicationId: string, confirmation: string): Promise<{ error?: string; deleted?: boolean }> {
  if (confirmation !== 'DELETE') return { error: 'Type DELETE to confirm removing this showcase.' };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: 'Please sign in again before deleting.' };
  const { data, error } = await db.rpc('hockey_showcase_publication_delete', { p_player: playerId, p_publication: publicationId });
  if (error) return { error: error.message };
  if (!data) return { error: 'The showcase was not found. Refresh the saved list.' };
  revalidatePath(`/players/${playerId}/showcase`);
  return { deleted: true };
}
