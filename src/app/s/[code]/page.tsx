import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Showcase } from '@/lib/hockey/showcase';
import Viewer from '../../showcase/[token]/Viewer';
export const metadata: Metadata = { title: 'Player Showcase', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^(?:[0-9]{6}|[0-9a-f]{12})$/i.test(code)) notFound();
  const db = await createClient();
  const { data, error } = await db.rpc('hockey_showcase_short_read', { p_code: code.toUpperCase() });
  if (error) throw new Error('Unable to load this showcase. Please try again later.');
  if (!data) notFound();
  return <Viewer data={data as Showcase} basePath={`/s/${code.toUpperCase()}`} />;
}
