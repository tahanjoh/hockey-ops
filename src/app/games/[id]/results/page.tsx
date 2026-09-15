import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { calculateGameImpact } from "@/lib/hockey/gameImpact";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GameResultsPage({
  params,
}: PageProps) {
  const { id: gameId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: game, error: gameError } = await supabase
    .from("games")
    .select(`
      id,
      opponent,
      position,
      location,
      game_date,
      status,
      team_score,
      opponent_score,
      players (
        first_name,
        last_name
      )
    `)
    .eq("id", gameId)
    .single();

  if (gameError || !game) {
    redirect("/");
  }

  const { data: events, error: eventsError } = await supabase
    .from("game_events")
    .select("id, event_type, note_text, period, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const count = (type: string) =>
    events?.filter(
      (event) => event.event_type === type,
    ).length ?? 0;

  const goals = count("goal");
  const assists = count("assist");

  const shotAttempts =
    count("shot") +
    count("sog") +
    goals;

  const shotsOnGoal =
    count("sog") +
    goals;

  const shotAccuracy =
    shotAttempts > 0
      ? (shotsOnGoal / shotAttempts) * 100
      : 0;

  const goalPercentage =
    shotsOnGoal > 0
      ? (goals / shotsOnGoal) * 100
      : 0;

  const goalFor =
    count("goal_for") +
    goals +
    assists;

  const goalAgainst =
    count("goal_against");

  const onIceDifferential =
    goalFor - goalAgainst;

  const {
    gameImpact,
    offensiveImpact,
    onIceImpact,
    puckManagementImpact,
    defensiveImpact,
  } = calculateGameImpact(
    game.position as "forward" | "defense",
    events ?? [],
  );

  const displayedGameImpact =
    gameImpact.toFixed(1);

  const formatImpact = (value: number) => {
    if (value > 0) {
      return `+${value.toFixed(2)}`;
    }

    return value.toFixed(2);
  };

  const formatDifferential = (
    value: number,
  ) => {
    if (value > 0) {
      return `+${value}`;
    }

    return String(value);
  };

  /*
   * GAME TAKEAWAYS
   *
   * These remain factual summaries of
   * tracked events rather than subjective
   * evaluations of the player's game.
   */
  const takeaways: string[] = [];

  const passes = count("pass");
  const turnovers = count("turnover");
  const bodyChecks = count("body_check");
  const blockedShots = count("block");
  const penalties = count("penalty");
  const icings = count("icing");
  const breakaways = count("breakaway");
  const offsides = count("offside");
  const takeawaysCount = count("takeaway");
  const burned = count("one_on_one_beaten");

  if (goals > 0 && assists > 0) {
    takeaways.push(
      `${goals} goal${
        goals === 1 ? "" : "s"
      } scored and ${assists} assist${
        assists === 1 ? "" : "s"
      } recorded.`,
    );
  } else if (goals > 0) {
    takeaways.push(
      `${goals} goal${
        goals === 1 ? "" : "s"
      } scored.`,
    );
  } else if (assists > 0) {
    takeaways.push(
      `${assists} assist${
        assists === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (goalFor > 0 || goalAgainst > 0) {
    takeaways.push(
      `On ice for ${goalFor} goal${
        goalFor === 1 ? "" : "s"
      } for and ${goalAgainst} against.`,
    );
  }

  if (
    game.position === "forward" &&
    breakaways > 0
  ) {
    takeaways.push(
      `${breakaways} break away${
        breakaways === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (
    game.position === "defense" &&
    takeawaysCount > 0
  ) {
    takeaways.push(
      `${takeawaysCount} takeaway${
        takeawaysCount === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (blockedShots > 0) {
    takeaways.push(
      `${blockedShots} blocked shot${
        blockedShots === 1 ? "" : "s"
      }.`,
    );
  }

  if (bodyChecks > 0) {
    takeaways.push(
      `${bodyChecks} body check${
        bodyChecks === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (passes > 0) {
    takeaways.push(
      `${passes} pass${
        passes === 1 ? "" : "es"
      } recorded.`,
    );
  }

  if (turnovers > 0) {
    takeaways.push(
      `${turnovers} turnover${
        turnovers === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (
    game.position === "defense" &&
    burned > 0
  ) {
    takeaways.push(
      `Burned ${burned} time${
        burned === 1 ? "" : "s"
      } in a tracked 1v1 situation.`,
    );
  }

  if (penalties > 0) {
    takeaways.push(
      `${penalties} penalt${
        penalties === 1 ? "y" : "ies"
      } recorded.`,
    );
  }

  if (icings > 0) {
    takeaways.push(
      `${icings} icing${
        icings === 1 ? "" : "s"
      } recorded.`,
    );
  }

  if (
    game.position === "forward" &&
    offsides > 0
  ) {
    takeaways.push(
      `${offsides} offside${
        offsides === 1 ? "" : "s"
      } recorded.`,
    );
  }

  const displayedTakeaways =
    takeaways.slice(0, 4);

  const player = Array.isArray(game.players)
    ? game.players[0]
    : game.players;

  const notes =
    events?.filter((event) =>
      [
        "positive_note",
        "improvement_note",
        "quick_note",
      ].includes(event.event_type),
    ) ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Game Complete
      </div>

      <h1 className="mt-1 text-3xl font-bold">
        {player?.first_name}
        {player?.last_name
          ? ` ${player.last_name}`
          : ""}
      </h1>

      <p className="mt-1 text-gray-600">
        vs {game.opponent} ·{" "}
        {game.position === "forward"
          ? "Forward"
          : "Defense"}
      </p>

      <div className="mt-6 rounded-2xl border p-5 text-center">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Final Score
        </div>

        <div className="mt-2 text-4xl font-bold">
          {game.team_score} -{" "}
          {game.opponent_score}
        </div>
      </div>

      <section className="mt-6">
        <div className="rounded-3xl border p-6 text-center">
          <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Game Impact
          </div>

          <div className="mt-2 text-6xl font-bold">
            {displayedGameImpact}
          </div>

          <div className="mt-1 text-sm text-gray-500">
            out of 10
          </div>

          <div className="mt-4 text-xs text-gray-400">
            Based on tracked objective game
            events
          </div>
        </div>
      </section>

      <section className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Offensive Impact
            </div>

            <div className="mt-1 text-2xl font-bold">
              {formatImpact(
                offensiveImpact,
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              On-Ice Impact
            </div>

            <div className="mt-1 text-2xl font-bold">
              {formatImpact(onIceImpact)}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Puck Management
            </div>

            <div className="mt-1 text-2xl font-bold">
              {formatImpact(
                puckManagementImpact,
              )}
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Defensive Impact
            </div>

            <div className="mt-1 text-2xl font-bold">
              {formatImpact(
                defensiveImpact,
              )}
            </div>
          </div>
        </div>
      </section>

      {displayedTakeaways.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Game Takeaways
          </h2>

          <div className="mt-3 space-y-2">
            {displayedTakeaways.map(
              (takeaway) => (
                <div
                  key={takeaway}
                  className="rounded-2xl border px-4 py-3 text-sm"
                >
                  {takeaway}
                </div>
              ),
            )}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
          Game Performance
        </h2>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-gray-100 px-2 py-3">
            <div className="text-xl font-bold">
              {goals}
            </div>

            <div className="text-[11px] text-gray-500">
              G
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3">
            <div className="text-xl font-bold">
              {assists}
            </div>

            <div className="text-[11px] text-gray-500">
              A
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3">
            <div className="text-xl font-bold">
              {shotAttempts}
            </div>

            <div className="text-[11px] text-gray-500">
              Attempts
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3">
            <div className="text-xl font-bold">
              {shotsOnGoal}
            </div>

            <div className="text-[11px] text-gray-500">
              SOG
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border px-4 py-4 text-center">
            <div className="text-xl font-bold">
              {shotAccuracy.toFixed(0)}%
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Shot Accuracy
            </div>
          </div>

          <div className="rounded-2xl border px-4 py-4 text-center">
            <div className="text-xl font-bold">
              {goalPercentage.toFixed(0)}%
            </div>

            <div className="mt-1 text-sm text-gray-500">
              Scoring %
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {formatDifferential(
                onIceDifferential,
              )}
            </div>

            <div className="text-[11px] text-gray-500">
              On Ice +/-
            </div>
          </div>

          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {passes}
            </div>

            <div className="text-[11px] text-gray-500">
              Passes
            </div>
          </div>

          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {turnovers}
            </div>

            <div className="text-[11px] text-gray-500">
              Turnovers
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {blockedShots}
            </div>

            <div className="text-[11px] text-gray-500">
              Blocked Shots
            </div>
          </div>

          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {bodyChecks}
            </div>

            <div className="text-[11px] text-gray-500">
              Body Checks
            </div>
          </div>

          <div className="rounded-xl border px-2 py-3">
            <div className="text-lg font-bold">
              {penalties}
            </div>

            <div className="text-[11px] text-gray-500">
              Penalties
            </div>
          </div>
        </div>

        {game.position === "forward" && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {breakaways}
              </div>

              <div className="text-[11px] text-gray-500">
                Break Aways
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {offsides}
              </div>

              <div className="text-[11px] text-gray-500">
                Off Sides
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {icings}
              </div>

              <div className="text-[11px] text-gray-500">
                Icings
              </div>
            </div>
          </div>
        )}

        {game.position === "defense" && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {takeawaysCount}
              </div>

              <div className="text-[11px] text-gray-500">
                Takeaways
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {burned}
              </div>

              <div className="text-[11px] text-gray-500">
                Burned
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3">
              <div className="text-lg font-bold">
                {icings}
              </div>

              <div className="text-[11px] text-gray-500">
                Icings
              </div>
            </div>
          </div>
        )}
      </section>

      {notes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Game Notes
          </h2>

          <div className="mt-3 space-y-3">
            {notes.map((event) => {
              const label =
                event.event_type ===
                "positive_note"
                  ? "Positive"
                  : event.event_type ===
                      "improvement_note"
                    ? "Improvement"
                    : "Quick Note";

              return (
                <div
                  key={event.id}
                  className="rounded-2xl border p-4"
                >
                  <div className="text-sm font-bold">
                    {label}
                  </div>

                  <div className="mt-1 text-sm text-gray-600">
                    {event.note_text ||
                      "No details added"}
                  </div>

                  <div className="mt-2 text-xs text-gray-400">
                    {event.period
                      ? event.period === 4
                        ? "OT"
                        : `P${event.period}`
                      : "—"}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-8 space-y-3">
        <Link
          href={`/games/${gameId}/edit`}
          className="block w-full rounded-2xl border px-4 py-4 text-center font-semibold"
        >
          Edit Game
        </Link>

        <Link
          href="/"
          className="block w-full rounded-2xl bg-black px-4 py-4 text-center font-semibold text-white"
        >
          Submit Game
        </Link>
      </div>

      <div className="h-12" />
    </main>
  );
}