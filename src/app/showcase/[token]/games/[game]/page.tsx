import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicGame, type Showcase } from '@/lib/hockey/showcase';
import PublicGame from '@/components/showcase/PublicGame';
export const metadata = { title: 'Showcase Game', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function Page({ params }: { params: Promise<{ token: string; game: string }> }) {
  const { token, game: key } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) notFound();
  const db = await createClient();
  const { data, error } = await db.rpc('hockey_showcase_read', { p_token: token });
  if (error) throw new Error('Unable to load this showcase. Please try again later.');
  if (!data) notFound();
  const game = publicGame(data as Showcase, key);
  if (!game) notFound();
  return <PublicGame data={data as Showcase} game={game} basePath={`/showcase/${token}`} />;
}
