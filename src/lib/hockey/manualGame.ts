import { parseVideoUrl } from './videoUrl';
export type ManualPlay = { id: string; event_type: 'goal' | 'assist'; period: string; clock_time: string; video_url: string };
export type ManualStats = { goals: number | null; assists: number | null; plus_minus: number | null };
export function optionalInteger(value: unknown, label: string, min = 0, max = 99): number | null {
  if (value === '' || value == null) return null;
  if (!/^-?\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  return Number(value);
}
export function parseManualGame(form: FormData) {
  const opponent = String(form.get('opponent') ?? '').trim();
  const game_date = String(form.get('game_date') ?? '');
  if (!opponent || opponent.length > 150) throw new Error('Enter an opponent (150 characters or fewer).');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(game_date) || new Date(`${game_date}T12:00:00Z`).toISOString().slice(0,10) !== game_date) throw new Error('Enter a valid game date.');
  const position = String(form.get('position'));
  const home_away = String(form.get('home_away'));
  const game_type = String(form.get('game_type'));
  if (!['forward','defense'].includes(position) || !['home','away'].includes(home_away) || !['regular','tournament'].includes(game_type)) throw new Error('Choose the game details.');
  const stats: ManualStats = { goals: optionalInteger(form.get('goals'),'Goals'), assists: optionalInteger(form.get('assists'),'Assists'), plus_minus: optionalInteger(form.get('plus_minus'),'Plus/minus',-99) };
  const raw: unknown = JSON.parse(String(form.get('plays') ?? '[]'));
  if (!Array.isArray(raw) || raw.length > 198) throw new Error('Too many highlights.');
  const ids = new Set<string>();
  const plays = raw.map((p: ManualPlay) => {
    if (!p || !['goal','assist'].includes(p.event_type) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(p.id) || ids.has(p.id)) throw new Error('Invalid highlight.');
    ids.add(p.id);
    const period = optionalInteger(p.period,'Period',1,4);
    const clock_time = String(p.clock_time ?? '').trim();
    if (clock_time && !/^\d{1,2}:[0-5]\d$/.test(clock_time)) throw new Error('Use M:SS for clock time, for example 8:42.');
    return { id: p.id, event_type: p.event_type, period, clock_time: clock_time || null, video_url: parseVideoUrl(String(p.video_url ?? '')) };
  });
  for (const type of ['goal','assist'] as const) {
    const total = stats[type === 'goal' ? 'goals' : 'assists'];
    if (plays.filter(p => p.event_type === type).length > (total ?? 0)) throw new Error(`Enter the total ${type === 'goal' ? 'goals' : 'assists'} before adding that many highlights.`);
  }
  return { opponent, game_date, position, home_away, game_type, team_score: optionalInteger(form.get('team_score'),'Team score'), opponent_score: optionalInteger(form.get('opponent_score'),'Opponent score'), stats, plays };
}
