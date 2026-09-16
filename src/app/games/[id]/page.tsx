import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import GameTracker from "./GameTracker";
import EndGameDialog from "./EndGameDialog";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function GamePage({ params }: PageProps) {
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
      player_id,
      opponent,
      position,
      game_type,
      home_away,
      game_date,
      status,
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

  if (game.status === "completed") {
    redirect(`/games/${gameId}/results`);
  }

  const gamePlayerId = game.player_id;

  const { data: events, error: eventsError } = await supabase
    .from("game_events")
    .select("id, event_type, note_text, period, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const { data: shifts, error: shiftsError } = await supabase
    .from("game_shifts")
    .select("id, period, started_at, ended_at")
    .eq("game_id", gameId)
    .order("started_at", { ascending: true });

  if (shiftsError) {
    throw new Error(shiftsError.message);
  }

  async function addEvent(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: currentGame } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (!currentGame || currentGame.status !== "in_progress") {
      redirect(`/games/${gameId}/results`);
    }

    const eventType = String(formData.get("event_type") || "");
    const noteText = String(formData.get("note_text") || "").trim();

    const periodValue = Number(formData.get("period") || 1);

    const allowed = [
      "goal",
      "assist",
      "missed_shot",
      "sog",
      "goal_for",
      "goal_against",
      "pass",
      "icing",
      "breakaway",
      "body_check",
      "penalty",
      "offside",
      "takeaway",
      "turnover",
      "blocked_shot",
      "burned",
      "positive_note",
      "improvement_note",
      "quick_note",
    ];

    if (!allowed.includes(eventType)) {
      throw new Error("Invalid event type.");
    }

    const { error } = await supabase
      .from("game_events")
      .insert({
        game_id: gameId,
        created_by: user.id,
        event_type: eventType,
        note_text: noteText || null,
        period: periodValue,
      });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/games/${gameId}`);
  }

  async function startShift(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const period = Number(formData.get("period") || 1);

    if (![1, 2, 3, 4].includes(period)) {
      throw new Error("Invalid period.");
    }

    const { data: currentGame } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (!currentGame || currentGame.status !== "in_progress") {
      redirect(`/games/${gameId}/results`);
    }

    const { error } = await supabase
      .from("game_shifts")
      .insert({
        game_id: gameId,
        created_by: user.id,
        period,
      });

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/games/${gameId}`);
  }

  async function endShift(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const shiftId = String(formData.get("shift_id") || "");

    if (!shiftId) {
      throw new Error("Missing shift.");
    }

    const { error } = await supabase
      .from("game_shifts")
      .update({
        ended_at: new Date().toISOString(),
      })
      .eq("id", shiftId)
      .eq("game_id", gameId)
      .eq("created_by", user.id)
      .is("ended_at", null);

    if (error) {
      throw new Error(error.message);
    }

    revalidatePath(`/games/${gameId}`);

  }

  async function undoLastEvent() {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const { data: currentGame } = await supabase
      .from("games")
      .select("status")
      .eq("id", gameId)
      .single();

    if (!currentGame || currentGame.status !== "in_progress") {
      redirect(`/games/${gameId}/results`);
    }

    const { data: lastEvent, error: lookupError } = await supabase
      .from("game_events")
      .select("id")
      .eq("game_id", gameId)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (lastEvent) {
      const { error } = await supabase
        .from("game_events")
        .delete()
        .eq("id", lastEvent.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    redirect(`/games/${gameId}`);
  }

  async function endGame(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const teamScore = Number(formData.get("team_score"));
    const opponentScore = Number(formData.get("opponent_score"));

    if (
      !Number.isInteger(teamScore) ||
      !Number.isInteger(opponentScore) ||
      teamScore < 0 ||
      opponentScore < 0
    ) {
      throw new Error("Invalid final score.");
    }

    const completedAt = new Date().toISOString();

    const { error: shiftError } = await supabase
      .from("game_shifts")
      .update({
        ended_at: completedAt,
      })
      .eq("game_id", gameId)
      .eq("created_by", user.id)
      .is("ended_at", null);

    if (shiftError) {
      throw new Error(shiftError.message);
    }

    const { error: gameError } = await supabase
      .from("games")
      .update({
        status: "completed",
        completed_at: completedAt,
        team_score: teamScore,
        opponent_score: opponentScore,
      })
      .eq("id", gameId);

    if (gameError) {
      throw new Error(gameError.message);
    }

    redirect(`/games/${gameId}/results`);
  }

  const count = (type: string) =>
    events?.filter((event) => event.event_type === type).length ?? 0;

  const goals = count("goal");

  const shotAttempts =
    count("missed_shot") +
    count("sog") +
    goals;

  const shotsOnGoal =
    count("sog") +
    goals;

  const goalFor =
    count("goal_for") +
    goals +
    count("assist");

  const goalAgainst =
    count("goal_against");

  const onIceDifferential =
    goalFor - goalAgainst;

  const suggestedTeamScore =
    count("goal") +
    count("assist") +
    count("goal_for");

  const suggestedOpponentScore =
    count("goal_against");

  const formatDifferential = (value: number) => {
    if (value > 0) return `+${value}`;
    return String(value);
  };

  const player = Array.isArray(game.players)
    ? game.players[0]
    : game.players;

  const eventLabel = (type: string) => {
    const labels: Record<string, string> = {
      goal: "Scored Goal",
      assist: "Got Assist",
      missed_shot: "Missed Shot",
      sog: "SOG",

      goal_for: "Line Goal",
      goal_against: "Goal Against",

      pass: "Pass",
      icing: "Icing",
      breakaway: "Break Away",
      body_check: "Body Check",
      penalty: "Penalty",
      offside: "Off Sides",

      takeaway: "Takeaway",
      turnover: "Turnover",
      blocked_shot: "Blocked Shot",
      burned: "Burned",

      positive_note: "Positive Note",
      improvement_note: "Improvement Note",
      quick_note: "Quick Note",
    };

    return labels[type] ?? type;
  };

  const lastEvent =
    events && events.length > 0
      ? events[events.length - 1]
      : null;

  const performanceEvents =
    events
      ?.filter(
        (event) =>
          ![
            "positive_note",
            "improvement_note",
            "quick_note",
          ].includes(event.event_type),
      )
      .slice(-8)
      .reverse() ?? [];

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-5">
      <header className="sticky top-0 z-10 -mx-4 border-b bg-white px-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Live Game
            </p>

            <h1 className="text-2xl font-bold">
              {player?.first_name}
              {player?.last_name ? ` ${player.last_name}` : ""}
            </h1>

            <p className="mt-1 text-sm text-gray-600">
              vs {game.opponent} ·{" "}
              {game.position === "forward" ? "Forward" : "Defense"}
            </p>
          </div>

          <div className="text-right text-xs text-gray-500">
            <div>{game.game_date}</div>
            <div className="capitalize">
              {game.home_away}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-gray-100 px-2 py-2">
            <div className="text-lg font-bold">{count("goal")}</div>
            <div className="text-[11px] text-gray-500">G</div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-2">
            <div className="text-lg font-bold">{count("assist")}</div>
            <div className="text-[11px] text-gray-500">A</div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-2">
            <div className="text-lg font-bold">{shotAttempts}</div>
            <div className="text-[11px] text-gray-500">Attempts</div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-2">
            <div className="text-lg font-bold">{shotsOnGoal}</div>
            <div className="text-[11px] text-gray-500">SOG</div>
          </div>
        </div>
      </header>

      <GameTracker
        addEvent={addEvent}
        startShift={startShift}
        endShift={endShift}
        shifts={shifts ?? []}
        position={game.position as "forward" | "defense"}
        gameId={game.id}
      />

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Game Performance
          </h2>

          <span className="text-xs text-gray-400">
            Live Builder
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {formatDifferential(onIceDifferential)}
            </div>
            <div className="text-[11px] text-gray-500">
              On Ice +/-
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {count("pass")}
            </div>
            <div className="text-[11px] text-gray-500">
              Passes
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {count("body_check")}
            </div>
            <div className="text-[11px] text-gray-500">
              Body Checks
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {count("blocked_shot")}
            </div>
            <div className="text-[11px] text-gray-500">
              Blocked Shots
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {count("turnover")}
            </div>
            <div className="text-[11px] text-gray-500">
              Turnovers
            </div>
          </div>

          <div className="rounded-xl bg-gray-100 px-2 py-3 text-center">
            <div className="text-lg font-bold">
              {count("penalty")}
            </div>
            <div className="text-[11px] text-gray-500">
              Penalties
            </div>
          </div>
        </div>

        {game.position === "forward" && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("breakaway")}
              </div>
              <div className="text-[11px] text-gray-500">
                Break Aways
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("offside")}
              </div>
              <div className="text-[11px] text-gray-500">
                Off Sides
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("icing")}
              </div>
              <div className="text-[11px] text-gray-500">
                Icings
              </div>
            </div>
          </div>
        )}

        {game.position === "defense" && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("takeaway")}
              </div>
              <div className="text-[11px] text-gray-500">
                Takeaways
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("burned")}
              </div>
              <div className="text-[11px] text-gray-500">
                Burned
              </div>
            </div>

            <div className="rounded-xl border px-2 py-3 text-center">
              <div className="text-lg font-bold">
                {count("icing")}
              </div>
              <div className="text-[11px] text-gray-500">
                Icings
              </div>
            </div>
          </div>
        )}

      <div className="mt-6 mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Recent Activity
      </div>

      <div className="overflow-hidden rounded-2xl border">
        {performanceEvents.length === 0 ? (
          <div className="px-4 py-5 text-sm text-gray-500">
            No performance events entered yet.
          </div>
        ) : (
          performanceEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
            >
              <div className="font-semibold">
                {eventLabel(event.event_type)}
              </div>

              <div className="text-sm text-gray-500">
                {event.period
                  ? event.period === 4
                    ? "OT"
                    : `P${event.period}`
                  : "—"}
              </div>
            </div>
          ))
        )}
      </div>

      <section className="mt-3">
        <form action={undoLastEvent}>
          <button
            type="submit"
            disabled={!events?.length}
            className="w-full rounded-2xl border px-4 py-4 font-semibold disabled:opacity-40"
          >
            {lastEvent
              ? `Undo: ${eventLabel(lastEvent.event_type)}`
              : "Undo Last Event"}
          </button>
        </form>
      </section>

      </section>

      {events?.some((event) =>
        [
          "positive_note",
          "improvement_note",
          "quick_note",
        ].includes(event.event_type),
      ) && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Game Notes
          </h2>

          <div className="space-y-3">
            {events
              .filter((event) =>
                [
                  "positive_note",
                  "improvement_note",
                  "quick_note",
                ].includes(event.event_type),
              )
              .map((event) => {
                const label =
                  event.event_type === "positive_note"
                    ? "Positive"
                    : event.event_type === "improvement_note"
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
                      {event.note_text || "No details added"}
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                      <span>
                        {event.period
                          ? event.period === 4
                            ? "OT"
                            : `P${event.period}`
                          : "—"}
                      </span>

                      <span>·</span>

                      <span>
                        {new Date(event.created_at).toLocaleTimeString(
                          "en-US",
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      <section className="mt-8 border-t pt-6">
        <EndGameDialog
          endGame={endGame}
          suggestedTeamScore={suggestedTeamScore}
          suggestedOpponentScore={suggestedOpponentScore}
        />
      </section>

      <div className="h-12" />
    </main>
  );
}