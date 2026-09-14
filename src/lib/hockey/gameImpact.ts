export type HockeyEvent = {
  event_type: string;
};

export function calculateGameImpact(
  position: "forward" | "defense",
  events: HockeyEvent[],
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
          goal_against: -0.9,
          takeaway: 0.5,
          turnover: -0.6,
          block: 0.3,
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
          goal_against: -0.7,
          takeaway: 0.35,
          turnover: -0.5,
          block: 0.2,
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

  const shotAttempts =
    count("shot") +
    count("sog") +
    goals;

  const shotsOnGoal =
    count("sog") +
    goals;

  const goalsFor =
    count("goal_for") +
    count("goal") +
    count("assist");

  const offensiveImpact =
    goals * weights.goal +
    count("assist") * weights.assist +
    shotAttempts * weights.shot +
    shotsOnGoal * weights.sog +
    count("one_on_one_win") * weights.one_on_one_win;

  const onIceImpact =
    goalsFor * weights.goal_for +
    count("goal_against") * weights.goal_against;

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

  const defensiveImpact =
    count("block") * weights.block +
    count("one_on_one_stop") *
      weights.one_on_one_stop +
    count("one_on_one_beaten") *
      weights.one_on_one_beaten;

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