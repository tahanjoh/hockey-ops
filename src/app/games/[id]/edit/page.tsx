import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function EditGamePage({
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

  const { data: game, error } = await supabase
    .from("games")
    .select(`
      id,
      player_id,
      opponent,
      position,
      location,
      game_type,
      game_date,
      team_score,
      opponent_score,
      players (
        first_name,
        last_name
      )
    `)
    .eq("id", gameId)
    .single();

  if (error || !game) {
    redirect("/");
  }

  const safeGameId = game.id;
  const playerId = game.player_id;

  const { data: events, error: eventsError } = await supabase
    .from("game_events")
    .select("id, event_type, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const count = (type: string) =>
    events?.filter((event) => event.event_type === type).length ?? 0;

  async function updateGame(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const opponent = String(
      formData.get("opponent") || "",
    ).trim();

    const position = String(
      formData.get("position") || "",
    );

    const location = String(
      formData.get("location") || "",
    );

    const gameType = String(
      formData.get("game_type") || "",
    );

    const gameDate = String(
      formData.get("game_date") || "",
    );

    const teamScore = Number(
      formData.get("team_score"),
    );

    const opponentScore = Number(
      formData.get("opponent_score"),
    );

    if (
      !opponent ||
      !["forward", "defense"].includes(position) ||
      !["home", "away"].includes(location) ||
      !["regular", "tournament"].includes(gameType) ||
      !gameDate ||
      !Number.isInteger(teamScore) ||
      !Number.isInteger(opponentScore) ||
      teamScore < 0 ||
      opponentScore < 0
    ) {
      throw new Error(
        "Missing or invalid game information.",
      );
    }

    const { error } = await supabase
      .from("games")
      .update({
        opponent,
        position,
        location,
        game_type: gameType,
        game_date: gameDate,
        team_score: teamScore,
        opponent_score: opponentScore,
      })
      .eq("id", gameId);

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/games/${gameId}/results`);
  }

  async function addStat(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const eventType = String(formData.get("event_type") || "");

    const allowedEventTypes = [
      "goal",
      "assist",
      "sog",
      "shot",
      "goal_for",
      "goal_against",
      "takeaway",
      "turnover",
      "block",
      "entry_possession",
      "dump_in",
      "failed_entry",
      "exit_possession",
      "clear",
      "failed_exit",
      "one_on_one_win",
      "one_on_one_stop",
      "one_on_one_beaten",
      "pass",
      "icing",
      "breakaway",
      "body_check",
      "penalty",
      "offside",
    ];

    if (!allowedEventTypes.includes(eventType)) {
      throw new Error("Invalid event type");
    }

    const { error } = await supabase.from("game_events").insert({
      game_id: safeGameId,
      player_id: playerId,
      created_by: user.id,
      event_type: eventType,
      period: null,
    });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/games/${safeGameId}/edit`);
  }

  async function removeStat(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const eventType = String(formData.get("event_type") || "");

    const allowedEventTypes = [
      "goal",
      "assist",
      "sog",
      "shot",
      "goal_for",
      "goal_against",
      "takeaway",
      "turnover",
      "block",
      "entry_possession",
      "dump_in",
      "failed_entry",
      "exit_possession",
      "clear",
      "failed_exit",
      "one_on_one_win",
      "one_on_one_stop",
      "one_on_one_beaten",
      "pass",
      "icing",
      "breakaway",
      "body_check",
      "penalty",
      "offside",
    ];

    if (!allowedEventTypes.includes(eventType)) {
      throw new Error("Invalid event type");
    }

    const { data: event, error: findError } = await supabase
      .from("game_events")
      .select("id")
      .eq("game_id", safeGameId)
      .eq("event_type", eventType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      throw new Error(findError.message);
    }

    if (event) {
      const { error: deleteError } = await supabase
        .from("game_events")
        .delete()
        .eq("id", event.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }
    }

    redirect(`/games/${safeGameId}/edit`);
  }

  const player = Array.isArray(game.players)
    ? game.players[0]
    : game.players;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Edit Game
      </p>

      <h1 className="mt-1 text-3xl font-bold">
        {player?.first_name}
        {player?.last_name
          ? ` ${player.last_name}`
          : ""}
      </h1>

      <form
        action={updateGame}
        className="mt-8 space-y-6"
      >
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Game Date
          </label>

          <input
            type="date"
            name="game_date"
            required
            defaultValue={game.game_date}
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Opponent
          </label>

          <input
            name="opponent"
            required
            defaultValue={game.opponent}
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold">
            Position
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="position"
                value="forward"
                defaultChecked={
                  game.position === "forward"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Forward
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name="position"
                value="defense"
                defaultChecked={
                  game.position === "defense"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Defense
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold">
            Home / Away
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="location"
                value="home"
                defaultChecked={
                  game.location === "home"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Home
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name="location"
                value="away"
                defaultChecked={
                  game.location === "away"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Away
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold">
            Game Type
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="cursor-pointer">
              <input
                type="radio"
                name="game_type"
                value="regular"
                defaultChecked={
                  game.game_type === "regular"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Regular
              </div>
            </label>

            <label className="cursor-pointer">
              <input
                type="radio"
                name="game_type"
                value="tournament"
                defaultChecked={
                  game.game_type === "tournament"
                }
                className="peer sr-only"
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Tournament
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-sm font-semibold">
            Final Score
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-semibold">
              Our Score
              <input
                type="number"
                name="team_score"
                min="0"
                required
                defaultValue={
                  game.team_score ?? 0
                }
                className="mt-2 w-full rounded-xl border px-4 py-3 text-center text-lg"
              />
            </label>

            <label className="text-sm font-semibold">
              Opponent
              <input
                type="number"
                name="opponent_score"
                min="0"
                required
                defaultValue={
                  game.opponent_score ?? 0
                }
                className="mt-2 w-full rounded-xl border px-4 py-3 text-center text-lg"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-4 text-lg font-semibold text-white"
        >
          Save Game Details
        </button>
      </form>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          Game Stats
        </h2>

        <div className="space-y-3">
          {[
            ["Scored Goals", "goal"],
            ["Assists", "assist"],
            ["SOG", "sog"],
            ["Missed Shots", "shot"],
            ["Line Goals", "goal_for"],
            ["Goal Against", "goal_against"],
            ["Passes", "pass"],
            ["Turnovers", "turnover"],
            ["Body Checks", "body_check"],
            ["Blocked Shots", "block"],
            ["Penalties", "penalty"],
            ["Icings", "icing"],
          ].map(([label, type]) => (
            <div
              key={type}
              className="flex items-center justify-between rounded-xl border px-4 py-3"
            >
              <div>
                <div className="text-sm text-gray-500">
                  {label}
                </div>

                <div className="text-xl font-bold">
                  {count(type)}
                </div>
              </div>

              <div className="flex gap-2">
                <form action={removeStat}>
                  <input
                    type="hidden"
                    name="event_type"
                    value={type}
                  />

                  <button
                    type="submit"
                    className="h-11 w-11 rounded-xl border text-xl font-bold"
                  >
                    −
                  </button>
                </form>

                <form action={addStat}>
                  <input
                    type="hidden"
                    name="event_type"
                    value={type}
                  />

                  <button
                    type="submit"
                    className="h-11 w-11 rounded-xl bg-black text-xl font-bold text-white"
                  >
                    +
                  </button>
                </form>
              </div>
            </div>
          ))}

          {game.position === "forward" && (
            <>
              {[
                ["Break Aways", "breakaway"],
                ["Off Sides", "offside"],
              ].map(([label, type]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div>
                    <div className="text-sm text-gray-500">
                      {label}
                    </div>

                    <div className="text-xl font-bold">
                      {count(type)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <form action={removeStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={type}
                      />

                      <button
                        type="submit"
                        className="h-11 w-11 rounded-xl border text-xl font-bold"
                      >
                        −
                      </button>
                    </form>

                    <form action={addStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={type}
                      />

                      <button
                        type="submit"
                        className="h-11 w-11 rounded-xl bg-black text-xl font-bold text-white"
                      >
                        +
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </>
          )}

          {game.position === "defense" && (
            <>
              {[
                ["Takeaways", "takeaway"],
                ["Burned", "one_on_one_beaten"],
              ].map(([label, type]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-xl border px-4 py-3"
                >
                  <div>
                    <div className="text-sm text-gray-500">
                      {label}
                    </div>

                    <div className="text-xl font-bold">
                      {count(type)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <form action={removeStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={type}
                      />

                      <button
                        type="submit"
                        className="h-11 w-11 rounded-xl border text-xl font-bold"
                      >
                        −
                      </button>
                    </form>

                    <form action={addStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={type}
                      />

                      <button
                        type="submit"
                        className="h-11 w-11 rounded-xl bg-black text-xl font-bold text-white"
                      >
                        +
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </section>
    </main>
  );
}