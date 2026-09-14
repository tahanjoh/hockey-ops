import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error } = await supabase
    .from("player_memberships")
    .select(`
      player_id,
      players (
        id,
        first_name,
        last_name,
        birth_year
      )
    `)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          JudcoTech
        </p>

        <h1 className="mt-1 text-3xl font-bold">
          Hockey Ops
        </h1>
      </div>

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Players
          </h2>

          <Link
            href="/players/new"
            className="text-sm font-semibold underline"
          >
            Add Player
          </Link>
        </div>

        <div className="mt-4 space-y-4">
          {memberships?.length ? (
            memberships.map((membership) => {
              const player = Array.isArray(membership.players)
                ? membership.players[0]
                : membership.players;

              if (!player) {
                return null;
              }

              return (
                <div
                  key={player.id}
                  className="rounded-2xl border p-5"
                >
                  <div>
                    <h3 className="text-xl font-bold">
                      {player.first_name}
                      {player.last_name
                        ? ` ${player.last_name}`
                        : ""}
                    </h3>

                    {player.birth_year && (
                      <p className="mt-1 text-sm text-gray-500">
                        Born {player.birth_year}
                      </p>
                    )}
                  </div>

                    <div className="mt-5 grid grid-cols-1 gap-3">
                      <Link
                        href={`/games/new?player=${player.id}`}
                        className="rounded-xl bg-black px-4 py-3 text-center font-semibold text-white"
                      >
                        Start Game
                      </Link>

                      <Link
                        href={`/players/${player.id}/games`}
                        className="rounded-xl border px-4 py-3 text-center font-semibold"
                      >
                        Game History
                      </Link>
                    </div>

                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border p-5">
              <p className="font-semibold">
                No players yet.
              </p>

              <Link
                href="/players/new"
                className="mt-4 inline-block font-semibold underline"
              >
                Add your first player
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}