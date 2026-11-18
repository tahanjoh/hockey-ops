export type SavedShowcase = { id: string; title: string; code: string; enabled: boolean; created_at: string; games: number };
export function showcaseTitle(value: unknown) {
  const title = typeof value === 'string' ? value.trim() : '';
  if (!title || title.length > 120) throw new Error('Give this showcase a name (up to 120 characters).');
  return title;
}
