import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: Promise<{
    player?: string;
  }>;
};

export default async function NewGamePage({
  searchParams,
}: PageProps) {
  const { player: playerId } = await searchParams;

  if (!playerId) {
    redirect("/");
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: player, error } = await supabase
    .from("players")
    .select("id, first_name, last_name")
    .eq("id", playerId)
    .single();

  if (error || !player) {
    redirect("/");
  }

  async function startGame(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const position = String(formData.get("position") || "");
    const opponent = String(formData.get("opponent") || "").trim();
    const location = String(formData.get("location") || "");
    const gameType = String(formData.get("game_type") || "");
    const gameDate = String(formData.get("game_date") || "");

    if (
      !["forward", "defense"].includes(position) ||
      !opponent ||
      !["home", "away"].includes(location) ||
      !["regular", "tournament"].includes(gameType) ||
      !gameDate
    ) {
      throw new Error("Missing or invalid game information.");
    }

    const { data: game, error } = await supabase
      .from("games")
      .insert({
        player_id: playerId,
        created_by: user.id,
        position,
        opponent,
        location,
        game_type: gameType,
        game_date: gameDate,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    redirect(`/games/${game.id}`);
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        New Game
      </p>

      <h1 className="mt-1 text-3xl font-bold">
        {player.first_name}
        {player.last_name ? ` ${player.last_name}` : ""}
      </h1>

      <form action={startGame} className="mt-8 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            Game Date
          </label>

          <input
            type="date"
            name="game_date"
            required
            defaultValue={today}
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
                className="peer sr-only"
                required
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
                className="peer sr-only"
                required
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Defense
              </div>
            </label>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Opponent
          </label>

          <input
            name="opponent"
            required
            placeholder="Team name"
            className="w-full rounded-xl border px-4 py-3"
          />
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
                className="peer sr-only"
                required
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
                className="peer sr-only"
                required
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
                className="peer sr-only"
                required
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
                className="peer sr-only"
                required
              />

              <div className="rounded-xl border px-4 py-4 text-center font-semibold peer-checked:border-black peer-checked:bg-black peer-checked:text-white">
                Tournament
              </div>
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-4 text-lg font-semibold text-white"
        >
          Start Game
        </button>
      </form>
    </main>
  );
}