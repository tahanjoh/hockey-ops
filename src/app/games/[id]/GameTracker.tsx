"use client";

import { useEffect, useState, useTransition } from "react";
import GameNoteButtons from "./GameNoteButtons";

type Shift = {
  id: string;
  period: number;
  started_at: string;
  ended_at: string | null;
};

type Props = {
  addEvent: (formData: FormData) => void | Promise<void>;
  startShift: (formData: FormData) => void | Promise<void>;
  endShift: (formData: FormData) => void | Promise<void>;
  shifts: Shift[];
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
  startShift,
  endShift,
  shifts,
  position,
  gameId,
}: Props) {
  const [period, setPeriod] = useState(1);

  const [isShiftPending, startShiftTransition] =
    useTransition();

  const [totalIceSeconds, setTotalIceSeconds] =
    useState(0);
  const [currentShiftSeconds, setCurrentShiftSeconds] =
    useState(0);

  const activeShift =
    shifts.find((shift) => shift.ended_at === null) ?? null;

  const isOnIce = activeShift !== null;

  const shiftStartedAt =
    activeShift?.started_at ?? null;

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

  useEffect(() => {
    const completedSeconds = shifts.reduce((total, shift) => {
      if (!shift.ended_at) return total;

      const started = new Date(shift.started_at).getTime();
      const ended = new Date(shift.ended_at).getTime();

      return total + Math.max(0, Math.floor((ended - started) / 1000));
    }, 0);

    const timer = window.setTimeout(() => {
      setTotalIceSeconds(completedSeconds);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [shifts]);

  useEffect(() => {
    if (!isOnIce || !shiftStartedAt) return;

    const startedAtMs = new Date(shiftStartedAt).getTime();

    function updateTimer() {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - startedAtMs) / 1000),
      );

      setCurrentShiftSeconds(elapsed);
    }

    updateTimer();

    const timer = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(timer);
  }, [isOnIce, shiftStartedAt]);

  function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

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

      {/* Time on Ice */}
      <section className="mt-4 rounded-2xl border bg-gray-50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-gray-500">
              Time on Ice
            </div>

            <div className="mt-1 text-3xl font-bold tabular-nums">
              {formatTime(
                totalIceSeconds +
                  (isOnIce ? currentShiftSeconds : 0),
              )}
            </div>

            {isOnIce && (
              <div className="mt-1 text-xs font-semibold text-green-700">
                Current shift {formatTime(currentShiftSeconds)}
              </div>
            )}
          </div>

        {isOnIce && activeShift ? (
          <form
            action={(formData) => {
              startShiftTransition(async () => {
                await endShift(formData);
                setCurrentShiftSeconds(0);
              });
            }}
          >
            <input
              type="hidden"
              name="shift_id"
              value={activeShift.id}
            />

            <button
              type="submit"
              disabled={isShiftPending}
              className="min-h-14 rounded-xl border-2 border-red-500 bg-red-50 px-5 py-2 font-bold text-red-700 disabled:opacity-50"
            >
              {isShiftPending ? "STOPPING..." : "OFF ICE"}
            </button>
          </form>
        ) : (
          <form
            action={(formData) => {
              startShiftTransition(async () => {
                await startShift(formData);
              });
            }}
          >
            <input
              type="hidden"
              name="period"
              value={period}
            />

            <button
              type="submit"
              disabled={isShiftPending}
              className="min-h-14 rounded-xl border-2 border-green-600 bg-green-50 px-5 py-2 font-bold text-green-800 disabled:opacity-50"
            >
              {isShiftPending ? "STARTING..." : "ON ICE"}
            </button>
          </form>
        )}
        </div>
      </section>

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
            "missed_shot",
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
              "blocked_shot",
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
              "blocked_shot",
              "positive",
            )}

            {eventButton(
              "Body Check",
              "body_check",
              "positive",
            )}

            {eventButton(
              "Burned",
              "burned",
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