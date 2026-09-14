import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function NewPlayerPage() {
  async function createPlayer(formData: FormData) {
    "use server";

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    const firstName = String(formData.get("first_name") || "").trim();
    const lastName = String(formData.get("last_name") || "").trim();
    const birthYearValue = String(formData.get("birth_year") || "").trim();

    if (!firstName) {
      throw new Error("First name is required.");
    }

    const playerId = crypto.randomUUID();

    const { error: playerError } = await supabase
      .from("players")
      .insert({
        id: playerId,
        first_name: firstName,
        last_name: lastName || null,
        birth_year: birthYearValue
          ? Number(birthYearValue)
          : null,
      });

    if (playerError) {
      throw new Error(playerError.message);
    }

    const { error: membershipError } = await supabase
      .from("player_memberships")
      .insert({
        player_id: playerId,
        user_id: user.id,
        role: "parent",
      });

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    redirect("/");
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-8">
      <h1 className="text-3xl font-bold">Add Player</h1>

      <p className="mt-2 text-sm text-gray-600">
        Create the player profile you&apos;ll track in Hockey Ops.
      </p>

      <form action={createPlayer} className="mt-8 space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold">
            First name
          </label>

          <input
            name="first_name"
            required
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Last name
          </label>

          <input
            name="last_name"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">
            Birth year
          </label>

          <input
            name="birth_year"
            type="number"
            min="2000"
            max="2030"
            inputMode="numeric"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-black px-4 py-4 text-lg font-semibold text-white"
        >
          Create Player
        </button>
      </form>
    </main>
  );
}