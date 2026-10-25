import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import type {Showcase} from '@/lib/hockey/showcase';
import Viewer from './Viewer';
export const metadata:Metadata={title:'Player Showcase',robots:{index:false,follow:false},referrer:'no-referrer'};
export const dynamic='force-dynamic';
export const revalidate=0;
export default async function Page({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) notFound();
 const db=await createClient();
 const {data,error}=await db.rpc('hockey_showcase_read',{p_token:token});
 if(error) throw new Error('Unable to load this showcase. Please try again later.');
 if(!data) notFound();
 return <Viewer data={data as Showcase}/>;
}
