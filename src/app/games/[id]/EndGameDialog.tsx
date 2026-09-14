"use client";

import { useState } from "react";

type Props = {
  endGame: (formData: FormData) => void | Promise<void>;
  suggestedTeamScore: number;
  suggestedOpponentScore: number;
};

export default function EndGameDialog({
  endGame,
  suggestedTeamScore,
  suggestedOpponentScore,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-14 w-full rounded-2xl bg-black px-4 font-bold text-white"
      >
        End Game
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl">
            <h2 className="text-xl font-bold">
              Confirm Final Score
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Goals captured while tracking are prefilled.
              Adjust for any goals scored while the player was off the ice.
            </p>

            <form action={endGame} className="mt-5">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-semibold">
                  Our Score
                  <input
                    type="number"
                    name="team_score"
                    min="0"
                    required
                    defaultValue={suggestedTeamScore}
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
                    defaultValue={suggestedOpponentScore}
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-center text-lg"
                  />
                </label>
              </div>

              <button
                type="submit"
                className="mt-5 min-h-14 w-full rounded-2xl bg-black px-4 font-bold text-white"
              >
                Confirm & Finish
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 min-h-12 w-full rounded-2xl border px-4 font-semibold"
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}