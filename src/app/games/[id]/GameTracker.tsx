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
    ["Scored Goal", "goal"],
    ["Got Assist", "assist"],
    ["SOG", "sog"],
    ["Missed Shot", "shot"],
    ["1v1 Win", "one_on_one_win"],
    ["Takeaway", "takeaway"],
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
  ) {
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
          className="min-h-16 w-full rounded-2xl border px-3 py-4 text-base font-bold"
        >
          {label}
        </button>
      </form>
    );
  }

  return (
    <>
      <section className="mt-5">
        <div className="grid grid-cols-4 gap-2">
          {periods.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => selectPeriod(item.value)}
              className={`rounded-xl border px-2 py-3 text-sm font-bold ${
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

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          Offense
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {objectiveEvents.map(([label, type]) => (
            <div key={type}>
              {eventButton(label, type)}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          On-Ice Impact
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {eventButton("Goal For — No Point", "goal_for")}
          {eventButton("Goal Against", "goal_against")}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
          {position === "forward"
            ? "Puck Management / Zone Entries"
            : "Defense / Puck Management"}
        </h2>

        <div className="grid grid-cols-2 gap-3">
          {eventButton("Turnover", "turnover")}
          {eventButton("Block", "block")}
          {eventButton("1v1 Stop", "one_on_one_stop")}
          {eventButton("1v1 Beaten", "one_on_one_beaten")}

          {position === "forward" && (
            <>
              {eventButton(
                "Entry + Possession",
                "entry_possession",
              )}
              {eventButton(
                "Dump In",
                "dump_in",
              )}
              {eventButton(
                "Failed Entry",
                "failed_entry",
              )}
            </>
          )}

          {position === "defense" && (
            <>
              {eventButton(
                "Exit + Possession",
                "exit_possession",
              )}
              {eventButton("Clear", "clear")}
              {eventButton(
                "Failed Exit",
                "failed_exit",
              )}
            </>
          )}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
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