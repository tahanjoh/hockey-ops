export type LeagueLink = { name: string; url: string };
export type ShowcaseMedia = { images: string[]; leagues: LeagueLink[] };
// Accept only the JPEGs produced by the upload control, never SVG/HTML data URLs.
export function parseShowcaseMedia(imagesValue: unknown, leaguesValue: unknown): ShowcaseMedia {
 if (!Array.isArray(imagesValue) || imagesValue.length > 2) throw new Error('Choose up to two player photos.');
 const images = imagesValue.map(value => {
  if (typeof value !== 'string' || value.length > 160000 || !/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error('Invalid photo. Remove it and upload a JPG, PNG or WebP photo again.');
  return value;
 });
 if (!Array.isArray(leaguesValue) || leaguesValue.length > 8) throw new Error('Add up to eight leagues.');
 const leagues = leaguesValue.flatMap(value => {
  if (!value || typeof value !== 'object') throw new Error('Invalid league entry.');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const url = typeof value.url === 'string' ? value.url.trim() : '';
  if (!name && !url) return [];
  if (!name || name.length > 80 || !url || url.length > 2000) throw new Error('Give each league a name and a complete HTTPS stats link.');
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('Enter a complete league stats link starting with https://.'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('League links must start with https:// and contain no embedded login details.');
  return [{ name, url: parsed.href }];
 });
 return { images, leagues };
}
