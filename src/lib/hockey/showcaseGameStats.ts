import { calculateGameImpact } from './gameImpact';
import type { SummaryGame } from './playerSummary';
export type ShowcaseShift = { started_at: string; ended_at: string | null; clock_version?: number; elapsed_seconds?: number | null };
export type ShowcaseSourceGame = SummaryGame & { game_shifts?: ShowcaseShift[] };
export type TrackedGameStats = {
  impact: ReturnType<typeof calculateGameImpact>;
  attempts: number; missedShots: number; accuracy: number | null; scoringPercentage: number | null;
  onIceFor: number; onIceAgainst: number; differential: number;
  iceTime: { seconds: number; shifts: number; average: number } | null;
  events: { label: string; count: number }[];
};
export function showcaseGameStats(game: ShowcaseSourceGame): TrackedGameStats | undefined {
  if (game.entry_mode === 'manual') return undefined;
  const events = game.game_events ?? [];
  const count = (...types: string[]) => events.filter(event => types.includes(event.event_type)).length;
  const goals = count('goal'), sog = count('sog','goal');
  const attempts = sog + count('missed_shot','shot');
  const onIceFor = count('goal','assist','goal_for'), onIceAgainst = count('goal_against');
  let iceTime: TrackedGameStats['iceTime'] = null;
  if (Array.isArray(game.game_shifts)) {
    const shifts = game.game_shifts.filter(shift => shift.ended_at);
    const seconds = shifts.reduce((sum,shift) => {
      const value = shift.clock_version === 2 && typeof shift.elapsed_seconds === 'number'
        ? shift.elapsed_seconds : Math.floor((Date.parse(shift.ended_at!) - Date.parse(shift.started_at)) / 1000);
      return sum + (Number.isFinite(value) ? Math.max(0,value) : 0);
    },0);
    iceTime = { seconds, shifts: shifts.length, average: shifts.length ? Math.round(seconds/shifts.length) : 0 };
  }
  const definitions: [string,string[]][] = [
    ['Passes',['pass']],['Takeaways',['takeaway']],['Turnovers',['turnover']],
    ['Good forechecks',['good_forecheck']],['Good backchecks',['good_backcheck']],
    ['Responsible for goals against',['goal_against_responsible']],['Blocked shots',['block','blocked_shot']],
    ['Breakaways',['breakaway']],['Body checks',['body_check']],['Penalties',['penalty']],
    ['Icings',['icing']],['Offsides',['offside']],['Beaten on defense',['burned','one_on_one_beaten']],
  ];
  const legacy: [string,string[]][] = [
    ['Possession exits',['exit_possession']],['Clears',['clear']],['Failed exits',['failed_exit']],
    ['Possession entries',['entry_possession']],['Dump-ins',['dump_in']],['Failed entries',['failed_entry']],
    ['1-on-1 wins',['one_on_one_win']],['1-on-1 stops',['one_on_one_stop']],
  ];
  return {
    impact: calculateGameImpact(game.position === 'defense' ? 'defense' : 'forward',events,{team_score:game.team_score,opponent_score:game.opponent_score}),
    attempts, missedShots: count('missed_shot','shot'), accuracy: attempts ? sog/attempts*100 : null,
    scoringPercentage: sog ? goals/sog*100 : null, onIceFor,onIceAgainst,differential:onIceFor-onIceAgainst,iceTime,
    events:[...definitions,...legacy.filter(([,types]) => count(...types)>0)].map(([label,types]) => ({label,count:count(...types)})),
  };
}
export function formatShowcaseTime(seconds: number) {
  return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
}
