import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {showcaseClips} from '@/lib/hockey/showcase';
import type {SummaryGame} from '@/lib/hockey/playerSummary';
import Editor from './Editor';
import type {Showcase} from '@/lib/hockey/showcase';
export default async function Page({params}:{params:Promise<{id:string}>}) {
 const {id}=await params; const db=await createClient();
 const {data:{user}}=await db.auth.getUser(); if(!user) redirect('/login');
 const {data:parent}=await db.rpc('hockey_is_parent',{p_player:id}); if(!parent) redirect('/');
 const [{data:player},{data:games,error},{data:token,error:setupError}]=await Promise.all([db.from('players').select('first_name,last_name').eq('id',id).single(),db.from('games').select('*,game_events(*)').eq('player_id',id).eq('status','completed').order('game_date',{ascending:false}),db.rpc('hockey_showcase_short_manage',{p_player:id,p_action:'status'})]);
 if(error) throw new Error(error.message);
 const {data:published}=token&&!setupError?await db.rpc('hockey_showcase_short_read',{p_code:token}):{data:null};
 return <main className="mx-auto max-w-3xl p-5"><Link href={`/players/${id}/summary`} className="underline">← Player Summary</Link><h1 className="mt-6 text-3xl font-black">Build the brag book</h1><p className="my-3 text-gray-600">Choose what to share for {player?.first_name} {player?.last_name}. Anyone with the unique link can view it. No account or password needed.</p>{setupError ? <p role="alert">Apply the Player Showcase database migration before publishing.</p>:<Editor initial={published as Showcase|null} id={id} token={token as string|null} games={(games as SummaryGame[] ?? []).map(game=>({id:game.id,opponent:game.opponent,date:game.game_date,clips:showcaseClips(game)}))}/>}</main>;
}
