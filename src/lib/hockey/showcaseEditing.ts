import type { Showcase } from './showcase';
export type EditorGame = { id: string; opponent: string; date: string; clips: { key: string; url: string; label: string; title: string }[] };
export type ShowcaseSelection = { games: string[]; clips: { gameId: string; url: string }[] };
// IDs and URL associations stay in parent-only editor metadata, outside public snapshots.
export function restoreShowcaseSelection(games: EditorGame[], snapshot: Showcase | null, selection?: ShowcaseSelection | null) {
  const selected = new Set<string>();
  const clips = new Set<string>();
  let missing = false;
  if (selection && Array.isArray(selection.games) && Array.isArray(selection.clips)) {
    for (const id of selection.games) {
      const game = games.find(game => game.id === id);
      if (!game) { missing = true; continue; }
      selected.add(id);
      for (const clip of selection.clips.filter(clip => clip.gameId === id)) {
        const current = game.clips.find(current => current.url === clip.url);
        if (current) clips.add(current.key); else missing = true;
      }
    }
  } else if (snapshot) {
    for (const published of snapshot.games) {
      const matches = games.filter(game => game.opponent === published.opponent && game.date === published.date);
      if (matches.length !== 1) { missing = true; continue; }
      const game = matches[0]; selected.add(game.id);
      const publishedClips = published.clips ?? snapshot.clips.filter(clip => clip.opponent === published.opponent && clip.date === published.date);
      for (const clip of publishedClips) {
        const current = game.clips.find(current => current.url === clip.url);
        if (current) clips.add(current.key); else missing = true;
      }
    }
  }
  return { games: [...selected], clips: [...clips], missing };
}
