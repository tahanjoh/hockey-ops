"use client";

import { useEffect, useState } from "react";
import GameNoteButtons from "./GameNoteButtons";

type Props = {
  addEvent: (formData: FormData) => void | Promise<void>;
  position: "forward" | "defense";
  gameId: string;
};

type Impact = "positive" | "negative" | "neutral";

const periods = [
  { label: "1st", value: 1 },
  { label: "2nd", value: 2 },
  { label: "3rd", value: 3 },
  { label: "OT", value: 4 },
];

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
    impact: Impact = "neutral",
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
      {/* Period */}
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

      {/* Scoring */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          Scoring
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {eventButton(
            "Scored Goal",
            "goal",
            "positive",
          )}

          {eventButton(
            "Got Assist",
            "assist",
            "positive",
          )}

          {eventButton(
            "SOG",
            "sog",
            "positive",
          )}

          {eventButton(
            "Missed Shot",
            "shot",
            "neutral",
          )}

          {eventButton(
            "Line Goal",
            "goal_for",
            "positive",
          )}

          {eventButton(
            "Goal Against",
            "goal_against",
            "negative",
          )}
        </div>
      </section>

      {/* On-Ice Impact */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
          On-Ice Impact
        </h2>

        {position === "forward" ? (
          <div className="grid grid-cols-2 gap-2">
            {eventButton(
              "Pass",
              "pass",
              "positive",
            )}

            {eventButton(
              "Icing",
              "icing",
              "negative",
            )}

            {eventButton(
              "Break Away",
              "breakaway",
              "positive",
            )}

            {eventButton(
              "Turnover",
              "turnover",
              "negative",
            )}

            {eventButton(
              "Body Check",
              "body_check",
              "positive",
            )}

            {eventButton(
              "Penalty",
              "penalty",
              "negative",
            )}

            {eventButton(
              "Blocked Shot",
              "block",
              "positive",
            )}

            {eventButton(
              "Off Sides",
              "offside",
              "negative",
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {eventButton(
              "Pass",
              "pass",
              "positive",
            )}

            {eventButton(
              "Icing",
              "icing",
              "negative",
            )}

            {eventButton(
              "Takeaway",
              "takeaway",
              "positive",
            )}

            {eventButton(
              "Turnover",
              "turnover",
              "negative",
            )}

            {eventButton(
              "Blocked Shot",
              "block",
              "positive",
            )}

            {eventButton(
              "Body Check",
              "body_check",
              "positive",
            )}

            {eventButton(
              "Burned",
              "one_on_one_beaten",
              "negative",
            )}

            {eventButton(
              "Penalty",
              "penalty",
              "negative",
            )}
          </div>
        )}
      </section>

      {/* Observations */}
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