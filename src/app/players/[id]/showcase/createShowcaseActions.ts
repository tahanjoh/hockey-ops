'use server';
import { revalidatePath } from 'next/cache';
import { showcaseTitle } from '@/lib/hockey/savedShowcases';
import { createClient } from '@/lib/supabase/server';
import { parseShowcaseMedia } from '@/lib/hockey/showcaseMedia';
import { parseShowcaseExtras } from '@/lib/hockey/showcaseExtras';
import { buildShowcase } from '@/lib/hockey/showcase';
import { showcaseClips, type Showcase } from '@/lib/hockey/showcase';
import type { ShowcaseSelection } from '@/lib/hockey/showcaseEditing';
import type { SummaryGame } from '@/lib/hockey/playerSummary';
export async function saveShowcase(form: FormData): Promise<{error?: string; token?: string; disabled?: boolean; publicationId?: string}> {
 try {
  const db = await createClient();
  const {data:{user}} = await db.auth.getUser();
  if (!user) return {error:'Please sign in.'};
  const id = String(form.get('player'));
  const action = ['disable','rotate','update'].includes(String(form.get('action'))) ? String(form.get('action')) : 'publish';
  const {data:parent,error:parentError} = await db.rpc('hockey_is_parent',{p_player:id});
  if (parentError || !parent) return {error:'Only a parent with player access can manage this showcase.'};
  if (action === 'disable' || action === 'rotate') {
   const {data:publication,error} = await db.rpc('hockey_showcase_publication_manage',{p_player:id,p_action:action,p_publication:String(form.get('publication') ?? '')});
   if(error) return {error:error.message};
   revalidatePath(`/players/${id}/showcase`);
   return action === 'disable' ? {disabled:true,publicationId:publication.id} : {token:publication.code,publicationId:publication.id};
  }
  let title;
  try { title = showcaseTitle(form.get('title')); } catch(error) { return {error:error instanceof Error ? error.message : 'Enter a showcase name.'}; }
  let media;
  try { media = parseShowcaseMedia(JSON.parse(String(form.get('images') ?? '[]')),JSON.parse(String(form.get('leagues') ?? '[]'))); } catch(error) { return {error:error instanceof Error?error.message:'Invalid photos or leagues.'}; }
  let extras;
  try { extras = parseShowcaseExtras(form.get('message'), JSON.parse(String(form.get('links') ?? '[]'))); } catch(error) { return {error:error instanceof Error?error.message:'Invalid message or links.'}; }
  const sourceId = String(form.get('publication') ?? '');
  let original: { snapshot: Showcase; selection: ShowcaseSelection | null } | null = null;
  if (sourceId) {
    const {data:saved,error:loadError} = await db.rpc('hockey_showcase_publication_manage',{p_player:id,p_action:'get',p_publication:sourceId});
    if(loadError || !saved) return {error:'Unable to load the saved showcase. Reopen it and try again.'};
    original = saved;
  }
  if(action === 'update' && !sourceId) return {error:'Choose a saved showcase before saving changes.'};
  const {data:player,error:pe} = await db.from('players').select('first_name,last_name').eq('id',id).single();
  if(pe || !player) return {error:'Unable to load this player.'};
  const field = (key:string,max:number) => String(form.get(key) ?? '').trim().slice(0,max);
  const profile = {...media,...extras,team:field('team',80),jersey:field('jersey',8),position:field('position',40),graduation:field('graduation',4),bio:field('bio',500)};
  let snapshot: Showcase;
  let selection: ShowcaseSelection | null;
  if (original && form.get('selection_changed') !== 'true') {
    // Editing a note/profile must not drop archived clips or refresh historical stats.
    snapshot = {name:`${player.first_name} ${player.last_name}`,...profile,updated:new Date().toISOString(),games:original.snapshot.games,clips:original.snapshot.clips};
    selection = original.selection;
  } else {
    const ids = [...new Set(form.getAll('game').map(String))].slice(0,200);
    if(!ids.length) return {error:'Select at least one completed game.'};
    const {data:games,error:ge} = await db.from('games').select('*,game_events(*)').eq('player_id',id).eq('status','completed').in('id',ids).order('game_date',{ascending:false});
    if(ge || games?.length !== ids.length) return {error:'Unable to load selected games. Refresh and try again.'};
    const selected = new Set(form.getAll('clip').map(String));
    snapshot = buildShowcase(`${player.first_name} ${player.last_name}`,games as SummaryGame[],selected,profile);
    selection = {games:ids,clips:(games as SummaryGame[]).flatMap(game => showcaseClips(game).filter(clip => selected.has(clip.key)).map(clip => ({gameId:game.id,url:clip.url})))};
  }
  const {data:publication,error} = await db.rpc('hockey_showcase_publication_save',{
    p_player:id,p_publication:action === 'update' ? sourceId : null,p_snapshot:snapshot,p_title:title,p_selection:selection,
    p_expected_updated:action === 'update' ? String(form.get('version') ?? '') || null : null,
  });
  if(error) return {error:error.message};
  revalidatePath(`/players/${id}/showcase`);
  return {token:publication.code,publicationId:publication.id};
 } catch { return {error:'Unable to save. Please try again.'}; }
}
