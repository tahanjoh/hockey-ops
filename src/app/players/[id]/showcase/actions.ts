'use server';
import { createClient } from '@/lib/supabase/server';
import { buildShowcase } from '@/lib/hockey/showcase';
import type { SummaryGame } from '@/lib/hockey/playerSummary';
export async function saveShowcase(form: FormData): Promise<{error?: string; token?: string; disabled?: boolean}> {
 try {
  const db = await createClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) return {error:'Please sign in.'};
  const id = String(form.get('player'));
  const action = ['disable','rotate'].includes(String(form.get('action'))) ? String(form.get('action')) : 'publish';
  const {data:parent,error:parentError} = await db.rpc('hockey_is_parent',{p_player:id});
  if (parentError || !parent) return {error:'Only a parent with player access can manage this showcase.'};
  if (action === 'disable' || action === 'rotate') {
   const {data:token,error} = await db.rpc('hockey_showcase_manage',{p_player:id,p_action:action});
   return error ? {error:error.message} : action === 'disable' ? {disabled:true} : {token:token as string};
  }
  const ids = form.getAll('game').map(String).slice(0,200);
  if (!ids.length) return {error:'Select at least one completed game.'};
  const [{data:player,error:pe},{data:games,error:ge}] = await Promise.all([
   db.from('players').select('first_name,last_name').eq('id',id).single(),
   db.from('games').select('*,game_events(*)').eq('player_id',id).eq('status','completed').in('id',ids).order('game_date',{ascending:false})
  ]);
  if (pe || ge || !player || games?.length !== ids.length) return {error:'Unable to load selected games. Refresh and try again.'};
  const field = (key:string,max:number) => String(form.get(key) ?? '').trim().slice(0,max);
  const snapshot = buildShowcase(`${player.first_name} ${player.last_name}`, games as SummaryGame[],new Set(form.getAll('clip').map(String)),{team:field('team',80),jersey:field('jersey',8),position:field('position',40),graduation:field('graduation',4),bio:field('bio',500)});
  const {data:token,error} = await db.rpc('hockey_showcase_manage',{p_player:id,p_action:'publish',p_snapshot:snapshot});
  return error ? {error:error.message} : {token:token as string};
 } catch { return {error:'Unable to save. Please try again.'}; }
}
