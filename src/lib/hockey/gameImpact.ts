export type HockeyEvent = {
  event_type: string;
};

export function calculateGameImpact(
  position: "forward" | "defense",
  events: HockeyEvent[],
  score?: { team_score: number | null; opponent_score: number | null },
) {
  const count = (type: string) =>
    events.filter(
      (event) => event.event_type === type,
    ).length;

  const weights =
    position === "defense"
      ? {
          goal: 2.0,
          assist: 1.5,
          shot: 0.1,
          sog: 0.2,

          goal_for: 0.8,
          goal_against: 0,

          pass: 0.05,
          breakaway: 0,
          body_check: 0.2,
          penalty: -0.35,
          icing: -0.1,
          offside: 0,

          takeaway: 0.5,
          turnover: -0.6,
          block: 0.3,

          // Historical events
          exit_possession: 0.3,
          clear: 0.15,
          failed_exit: -0.3,
          entry_possession: 0,
          dump_in: 0,
          failed_entry: 0,
          one_on_one_win: 0.2,
          one_on_one_stop: 0.3,
          one_on_one_beaten: -0.3,
        }
      : {
          goal: 2.0,
          assist: 1.5,
          shot: 0.1,
          sog: 0.2,

          goal_for: 0.7,
          goal_against: 0,

          pass: 0.05,
          breakaway: 0.3,
          body_check: 0.15,
          penalty: -0.35,
          icing: -0.1,
          offside: -0.1,

          takeaway: 0.35,
          turnover: -0.5,
          block: 0.2,

          // Historical events
          exit_possession: 0,
          clear: 0,
          failed_exit: 0,
          entry_possession: 0.3,
          dump_in: 0.1,
          failed_entry: -0.3,
          one_on_one_win: 0.25,
          one_on_one_stop: 0.15,
          one_on_one_beaten: -0.15,
        };

  const goals = count("goal");
  // Final-score adjustment is deliberately modest: without the full goal sequence
  // we cannot reliably identify the actual deciding goal or assign causation.
  const team = score?.team_score;
  const opponent = score?.opponent_score;
  const knownScore = typeof team === "number" && typeof opponent === "number";
  const margin = knownScore ? Math.abs(team - opponent) : 0;
  const closeness = knownScore ? (margin <= 1 ? 1.5 : margin <= 3 ? 1.15 : 0.8) : 1;
  const scoringVolume = knownScore ? Math.max(0.7, Math.min(1.2, 3 / Math.max(1, team))) : 1;
  const scoringMultiplier = Math.max(0.65, Math.min(1.8, closeness * scoringVolume));
  const responsibleMultiplier = knownScore && team < opponent && margin <= 1 ? 1.6 : knownScore && margin >= 5 ? 0.7 : 1;


  const shotAttempts =
    count("missed_shot") +
    count("sog") +
    goals;

  const shotsOnGoal =
    count("sog") +
    goals;

  const goalsFor =
    count("goal_for") +
    goals +
    count("assist");

  /*
   * SCORING / OFFENSE
   *
   * Goals and assists remain the strongest
   * individual events.
   */
  const offensiveImpact =
    goals * weights.goal * scoringMultiplier +
    count("assist") * weights.assist * scoringMultiplier +
    shotAttempts * weights.shot +
    shotsOnGoal * weights.sog +
    count("breakaway") * weights.breakaway +
    count("one_on_one_win") *
      weights.one_on_one_win;

  /*
   * ON-ICE IMPACT
   *
   * Includes team goal impact plus the
   * observable events we're now tracking.
   */
  const onIceImpact =
    goalsFor * weights.goal_for +
    Math.max(0, count("goal_against") - count("goal_against_responsible")) * (-0.4) +
    count("pass") * weights.pass +
    count("body_check") *
      weights.body_check +
    count("penalty") * weights.penalty +
    count("icing") * weights.icing +
    count("offside") * weights.offside;

  /*
   * PUCK MANAGEMENT
   *
   * New games primarily use takeaway /
   * turnover. Old event types remain here
   * so historical games still calculate.
   */
  const puckManagementImpact =
    count("takeaway") * weights.takeaway +
    count("turnover") * weights.turnover +
    count("exit_possession") *
      weights.exit_possession +
    count("clear") * weights.clear +
    count("failed_exit") *
      weights.failed_exit +
    count("entry_possession") *
      weights.entry_possession +
    count("dump_in") * weights.dump_in +
    count("failed_entry") *
      weights.failed_entry;

  /*
   * DEFENSIVE IMPACT
   *
   * Blocked shots and the old 1v1 defensive
   * events remain supported.
   *
   * "Burned" uses one_on_one_beaten.
   */
  const defensiveImpact =
    count("blocked_shot") * weights.block +
    count("one_on_one_stop") *
      weights.one_on_one_stop +
    count("burned") * weights.one_on_one_beaten +
    count("good_forecheck") * 0.2 +
    count("good_backcheck") * 0.2 -
    count("goal_against_responsible") * 1.2 * responsibleMultiplier;

  const rawImpact =
    offensiveImpact +
    onIceImpact +
    puckManagementImpact +
    defensiveImpact;

  const gameImpact = Math.min(
    10,
    Math.max(1, 5 + rawImpact * 0.5),
  );

  return {
    gameImpact,
    rawImpact,
    offensiveImpact,
    onIceImpact,
    puckManagementImpact,
    defensiveImpact,
  };
}