"use client";

import { useEffect, useState } from "react";
import GameNoteButtons from "./GameNoteButtons";

type Props = {
  addEvent: (formData: FormData) => void | Promise<void>;
  position: "forward" | "defense";
  gameId: string;
};

  const periods = [
    { label: "1st", value: 1 },
    { label: "2nd", value: 2 },
    { label: "3rd", value: 3 },
    { label: "OT", value: 4 },
  ];

  const objectiveEvents = [
    ["Scored Goal", "goal", "positive"],
    ["Got Assist", "assist", "positive"],
    ["SOG", "sog", "positive"],
    ["Missed Shot", "shot", "positive"],
    ["1v1 Win", "one_on_one_win", "positive"],
    ["Takeaway", "takeaway", "positive"],
  ] as const;

  export default function GameTracker({
    addEvent,
    position,
    gameId,
  }: Props) {
    const [period, setPeriod] = useState(1);

  useEffect(() => {
    const savedPeriod = sessionStorage.getItem(
      `hockey-game-period-${gameId}`,
    );

    if (!savedPeriod) return;

    const timer = window.setTimeout(() => {
      setPeriod(Number(savedPeriod));
    }, 0);

    return () => window.clearTimeout(timer);
  }, [gameId]);

  function selectPeriod(newPeriod: number) {
    setPeriod(newPeriod);

    sessionStorage.setItem(
      `hockey-game-period-${gameId}`,
      String(newPeriod),
    );
  }

  function eventButton(
    label: string,
    eventType: string,
    impact: "positive" | "negative" | "neutral" = "neutral",
  ) {
    const impactClass =
      impact === "positive"
        ? "border-green-600 bg-green-50 text-green-800"
        : impact === "negative"
          ? "border-red-500 bg-red-50 text-red-700"
          : "border-gray-300 bg-white text-gray-900";

    return (
      <form action={addEvent}>
        <input
          type="hidden"
          name="event_type"
          value={eventType}
        />

        <input
          type="hidden"
          name="period"
          value={period}
        />

        <button
          type="submit"
          className={`min-h-14 w-full rounded-xl border-2 px-2 py-2 text-sm font-bold ${impactClass}`}
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <>
      <section className="mt-4">
        <div className="grid grid-cols-4 gap-2">
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectPeriod(item.value)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-bold ${
                period === item.value
                  ? "bg-black text-white"
                  : ""
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Offense
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {objectiveEvents.map(([label, type, impact]) => (
            <div key={type}>
              {eventButton(label, type, impact)}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          On-Ice Impact
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {eventButton("Line Goal", "goal_for", "positive")}
          {eventButton("Goal Against", "goal_against", "negative")}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          {position === "forward"
            ? "Puck Management / Zone Entries"
            : "Defense / Puck Management"}
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {eventButton("Turnover", "turnover", "negative")}
          {eventButton("Block", "block", "positive")}
          {eventButton("1v1 Loss", "one_on_one_beaten", "negative")}

          {position === "forward" && (
            <>
              {eventButton(
                "Entry + Possession",
                "entry_possession",
                "positive",
              )}

              {eventButton(
                "Dump In",
                "dump_in",
                "positive",
              )}

              {eventButton(
                "Failed Entry",
                "failed_entry",
                "negative",
              )}
            </>
          )}

          {position === "defense" && (
            <>
              {eventButton(
                "Exit + Possession",
                "exit_possession",
                "positive",
              )}

              {eventButton(
                "Clear",
                "clear",
                "positive",
              )}

              {eventButton(
                "Failed Exit",
                "failed_exit",
                "negative",
              )}
            </>
          )}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Observations
        </h2>

        <GameNoteButtons
          addEvent={addEvent}
          period={period}
        />
      </section>

    </>
  );
}