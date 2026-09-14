import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statGroups = [
  {
    title: "Offense",
    stats: [
      ["Scored Goals", "goal"],
      ["Got Assists", "assist"],
      ["SOG", "sog"],
      ["Missed Shots", "shot"],
      ["1v1 Wins", "one_on_one_win"],
      ["Takeaways", "takeaway"],
    ],
  },
  {
    title: "On-Ice Impact",
    stats: [
      ["Goal For — No Point", "goal_for"],
      ["Goal Against", "goal_against"],
    ],
  },
  {
    title: "Puck / Defensive",
    stats: [
      ["Turnovers", "turnover"],
      ["Blocks", "block"],
      ["1v1 Stops", "one_on_one_stop"],
      ["1v1 Beaten", "one_on_one_beaten"],
      ["Entry + Possession", "entry_possession"],
      ["Dump Ins", "dump_in"],
      ["Failed Entries", "failed_entry"],
      ["Exit + Possession", "exit_possession"],
      ["Clears", "clear"],
      ["Failed Exits", "failed_exit"],
    ],
  },
] as const;

const allowedEventTypes = statGroups.flatMap((group) =>
  group.stats.map(([, type]) => type),
);

export default async function CorrectStatsPage({
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
      player_id,
      opponent,
      position,
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

  async function addStat(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const eventType = String(
      formData.get("event_type") || "",
    );

    if (!allowedEventTypes.includes(
      eventType as (typeof allowedEventTypes)[number],
    )) {
      throw new Error("Invalid event type.");
    }

    const { data: currentGame } = await supabase
      .from("games")
      .select("id, player_id")
      .eq("id", gameId)
      .single();

    if (!currentGame) {
      redirect("/");
    }

    const { error } = await supabase
      .from("game_events")
      .insert({
        game_id: gameId,
        player_id: currentGame.player_id,
        created_by: user.id,
        event_type: eventType,
        period: null,
      });

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/games/${gameId}/stats`);
  }

  async function removeStat(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const eventType = String(
      formData.get("event_type") || "",
    );

    if (!allowedEventTypes.includes(
      eventType as (typeof allowedEventTypes)[number],
    )) {
      throw new Error("Invalid event type.");
    }

    const { data: event, error: lookupError } = await supabase
      .from("game_events")
      .select("id")
      .eq("game_id", gameId)
      .eq("event_type", eventType)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (event) {
      const { error } = await supabase
        .from("game_events")
        .delete()
        .eq("id", event.id);

      if (error) {
        throw new Error(error.message);
      }
    }

    redirect(`/games/${gameId}/stats`);
  }

  const player = Array.isArray(game.players)
    ? game.players[0]
    : game.players;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        Correct Stats
      </div>

      <h1 className="mt-1 text-3xl font-bold">
        {player?.first_name}
        {player?.last_name ? ` ${player.last_name}` : ""}
      </h1>

      <p className="mt-1 text-sm text-gray-500">
        vs {game.opponent}
      </p>

      <p className="mt-4 rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600">
        Use + or − to correct tracked game events. Game Impact will
        recalculate automatically.
      </p>

      <div className="mt-6 space-y-7">
        {statGroups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
              {group.title}
            </h2>

            <div className="overflow-hidden rounded-2xl border">
              {group.stats.map(([label, eventType]) => (
                <div
                  key={eventType}
                  className="flex items-center justify-between border-b px-4 py-3 last:border-b-0"
                >
                  <div>
                    <div className="font-semibold">
                      {label}
                    </div>

                    <div className="text-sm text-gray-500">
                      {count(eventType)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={removeStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={eventType}
                      />

                      <button
                        type="submit"
                        disabled={count(eventType) === 0}
                        className="h-11 w-11 rounded-xl border text-xl font-bold disabled:opacity-30"
                      >
                        −
                      </button>
                    </form>

                    <form action={addStat}>
                      <input
                        type="hidden"
                        name="event_type"
                        value={eventType}
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
            </div>
          </section>
        ))}
      </div>

      <div className="mt-8">
        <Link
          href={`/games/${gameId}/results`}
          className="block w-full rounded-2xl bg-black px-4 py-4 text-center font-semibold text-white"
        >
          Done
        </Link>
      </div>

      <div className="h-12" />
    </main>
  );
}