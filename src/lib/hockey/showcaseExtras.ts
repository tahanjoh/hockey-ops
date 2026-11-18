export type ShowcaseLink = { title: string; url: string };
export function parseShowcaseExtras(messageValue: unknown, linksValue: unknown) {
  const message = typeof messageValue === 'string' ? messageValue.trim() : '';
  if (message.length > 1500) throw new Error('Keep the showcase message to 1,500 characters or fewer.');
  if (!Array.isArray(linksValue) || linksValue.length > 8) throw new Error('Add up to eight extra links.');
  const links: ShowcaseLink[] = linksValue.flatMap(value => {
    if (!value || typeof value !== 'object') throw new Error('Invalid link entry.');
    const title = typeof value.title === 'string' ? value.title.trim() : '';
    const url = typeof value.url === 'string' ? value.url.trim() : '';
    if (!title && !url) return [];
    if (!title || title.length > 80 || !url || url.length > 2000) throw new Error('Give every link a title and complete HTTPS address.');
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Enter a complete link starting with https://.'); }
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error('Links must start with https:// and contain no embedded login details.');
    return [{ title, url: parsed.href }];
  });
  return { message, links };
}
export function showcasePath(code: string) {
  return /^(?:[0-9]{6}|[0-9a-f]{12})$/i.test(code) ? `/s/${code.toUpperCase()}` : `/showcase/${code}`;
}
