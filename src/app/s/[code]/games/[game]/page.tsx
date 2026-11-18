import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { publicGame, type Showcase } from '@/lib/hockey/showcase';
import PublicGame from '@/components/showcase/PublicGame';
export const metadata = { title: 'Showcase Game', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function Page({ params }: { params: Promise<{ code: string; game: string }> }) {
  const { code, game: key } = await params;
  if (!/^(?:[0-9]{6}|[0-9a-f]{12})$/i.test(code)) notFound();
  const db = await createClient();
  const { data, error } = await db.rpc('hockey_showcase_short_read', { p_code: code.toUpperCase() });
  if (error) {
      console.error('SHOWCASE_READ_ERROR', {
        code: error.code,
        message: error.message
      });
      throw new Error('Unable to load this showcase. Please try again later.');
    }
  if (!data) notFound();
  const game = publicGame(data as Showcase, key);
  if (!game) notFound();
  return <PublicGame data={data as Showcase} game={game} basePath={`/s/${code.toUpperCase()}`} />;
}
