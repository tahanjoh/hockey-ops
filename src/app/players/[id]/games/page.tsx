import Link from "next/link";
import { redirect } from "next/navigation";

import { calculateGameImpact } from "@/lib/hockey/gameImpact";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PlayerGamesPage({
  params,
}: PageProps) {
  const { id: playerId } = await params;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("id", playerId)
    .single();

  if (playerError || !player) {
    redirect("/");
  }

    const { data: games, error: gamesError } = await supabase
    .from("games")
    .select(`
        id,
        opponent,
        position,
        game_date,
        location,
        team_score,
        opponent_score,
        game_events (
        event_type
        )
    `)
    .eq("player_id", playerId)
    .eq("status", "completed")
    .order("game_date", { ascending: false })
    .order("completed_at", { ascending: false });

  if (gamesError) {
    throw new Error(gamesError.message);
  }

    const gamesPlayed = games?.length ?? 0;

    const seasonGoals =
    games?.reduce(
        (total, game) =>
        total +
        (game.game_events?.filter(
            (event) => event.event_type === "goal",
        ).length ?? 0),
        0,
    ) ?? 0;

    const seasonAssists =
    games?.reduce(
        (total, game) =>
        total +
        (game.game_events?.filter(
            (event) => event.event_type === "assist",
        ).length ?? 0),
        0,
    ) ?? 0;

    const seasonGameImpacts =
    games?.map((game) =>
        calculateGameImpact(
        game.position as "forward" | "defense",
        game.game_events ?? [],
        ).gameImpact,
    ) ?? [];

    const averageGameImpact =
    seasonGameImpacts.length > 0
        ? seasonGameImpacts.reduce(
            (sum, value) => sum + value,
            0,
        ) / seasonGameImpacts.length
        : 0;

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <Link
        href="/"
        className="text-sm font-semibold text-gray-500"
      >
        ← Players
      </Link>

      <div className="mt-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Game History
        </div>

        <h1 className="mt-1 text-3xl font-bold">
          {player.first_name}
          {player.last_name ? ` ${player.last_name}` : ""}
        </h1>
      </div>

    {gamesPlayed > 0 && (
    <section className="mt-6">
        <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-2xl bg-gray-100 px-3 py-4">
            <div className="text-2xl font-bold">
            {gamesPlayed}
            </div>
            <div className="mt-1 text-xs text-gray-500">
            Games
            </div>
        </div>

        <div className="rounded-2xl bg-gray-100 px-3 py-4">
            <div className="text-2xl font-bold">
            {averageGameImpact.toFixed(1)}
            </div>
            <div className="mt-1 text-xs text-gray-500">
            Avg Impact
            </div>
        </div>

        <div className="rounded-2xl bg-gray-100 px-3 py-4">
            <div className="text-2xl font-bold">
            {seasonGoals}
            </div>
            <div className="mt-1 text-xs text-gray-500">
            Goals
            </div>
        </div>

        <div className="rounded-2xl bg-gray-100 px-3 py-4">
            <div className="text-2xl font-bold">
            {seasonAssists}
            </div>
            <div className="mt-1 text-xs text-gray-500">
            Assists
            </div>
        </div>
        </div>
    </section>
    )}

      <div className="mt-6 space-y-3">
        {!games?.length ? (
          <div className="rounded-2xl border p-5 text-sm text-gray-500">
            No completed games yet.
          </div>
        ) : (
          games.map((game) => {

            const { gameImpact } = calculateGameImpact(
            game.position as "forward" | "defense",
            game.game_events ?? [],
            );

            return (
            <Link
              key={game.id}
              href={`/games/${game.id}/results`}
              className="block rounded-2xl border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-bold">
                    vs {game.opponent}
                  </div>

                  <div className="mt-1 text-sm text-gray-500">
                    {game.position === "forward"
                      ? "Forward"
                      : "Defense"}{" "}
                    · {game.location === "home" ? "Home" : "Away"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold">
                    {game.team_score} - {game.opponent_score}
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    {game.game_date}
                  </div>
                </div>
              </div>

                <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Game Impact
                </span>

                <span className="text-xl font-bold">
                    {gameImpact.toFixed(1)}
                </span>
                </div>

            </Link>
            );
            })
        )}
      </div>

      <div className="h-12" />
    </main>
  );
}