"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import GameNoteButtons from "./GameNoteButtons";
import { normalizeClock } from "./clockFormat";

type Shift = {
  id: string;
  period: number;
  started_at: string;
  ended_at: string | null;
  clock_version: number;
  clock_running: boolean;
  clock_started_at: string | null;
  elapsed_seconds: number;
};

type Props = {
  addEvent: (formData: FormData) => Promise<void>;
  startShift: (formData: FormData) => void | Promise<void>;
  setShiftClock: (formData: FormData) => void | Promise<void>;
  endShift: (formData: FormData) => void | Promise<void>;
  shifts: Shift[];
  position: "forward" | "defense";
  gameId: string;
  savedEventIds: string[];
};

type Impact = "positive" | "negative" | "neutral";

const periods = [
  { label: "1st", value: 1 },
  { label: "2nd", value: 2 },
  { label: "3rd", value: 3 },
  { label: "OT", value: 4 },
];

type QueuedEvent = {
  client_event_id: string;
  event_type: string;
  period: number;
  note_text: string;
  clock_time: string;
};

export default function GameTracker({
  addEvent,
  startShift,
  setShiftClock,
  endShift,
  shifts,
  position,
  gameId,
  savedEventIds,
}: Props) {
  const [period, setPeriod] = useState(1);
  const router = useRouter();
  const queueKey = `hockey-pending-events-${gameId}`;
  const queueRef = useRef<QueuedEvent[]>([]);
  const flushingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");
  const [pendingTypes, setPendingTypes] = useState<string[]>([]);
  const addEventRef = useRef(addEvent);
  useEffect(() => { addEventRef.current = addEvent; }, [addEvent]);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length) {
        const item = queueRef.current[0];
        const formData = new FormData();
        for (const [key, value] of Object.entries(item)) formData.set(key, String(value));
        try {
          await addEventRef.current(formData);
        } catch {
          setSaveStatus("Not saved yet. Check connection and retry.");
          break;
        }
        queueRef.current = queueRef.current.filter(
          (queued) => queued.client_event_id !== item.client_event_id,
        );
        localStorage.setItem(queueKey, JSON.stringify(queueRef.current));
        setPendingCount(queueRef.current.length);
        setPendingTypes(queueRef.current.map((event) => event.event_type));
        setSaveStatus(queueRef.current.length ? "Saving…" : "Saved");
        router.refresh();
      }
    } finally {
      flushingRef.current = false;
    }
  }, [queueKey, router]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(queueKey) || "[]");
      queueRef.current = Array.isArray(saved) ? saved : [];
      setPendingCount(queueRef.current.length);
      setPendingTypes(queueRef.current.map((event) => event.event_type));
      if (queueRef.current.length) void flushQueue();
    } catch {
      setSaveStatus("Could not read saved activity on this device.");
    }
    const retry = () => void flushQueue();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [queueKey, flushQueue]);

  // A refreshed server list is also confirmation, even if the action response
  // arrives late. Never keep displaying Saving for an event already persisted.
  useEffect(() => {
    const confirmed = new Set(savedEventIds);
    const remaining = queueRef.current.filter((event) => !confirmed.has(event.client_event_id));
    if (remaining.length === queueRef.current.length) return;
    queueRef.current = remaining;
    try { localStorage.setItem(queueKey, JSON.stringify(remaining)); } catch { /* Server confirmation still stands. */ }
    setPendingCount(remaining.length);
    setPendingTypes(remaining.map((event) => event.event_type));
    setSaveStatus(remaining.length ? "Saving…" : "Saved");
  }, [savedEventIds, queueKey]);

  function recordEvent(formData: FormData) {
    const clockTime = normalizeClock(String(formData.get("clock_time") || ""));
    if (clockTime === null) {
      setSaveStatus("Clock must be MM:SS with seconds from 00 to 59.");
      return;
    }
    const item: QueuedEvent = {
      client_event_id: crypto.randomUUID(),
      event_type: String(formData.get("event_type") || ""),
      period: Number(formData.get("period") || 1),
      note_text: String(formData.get("note_text") || ""),
      clock_time: clockTime,
    };
    queueRef.current = [...queueRef.current, item];
    try {
      localStorage.setItem(queueKey, JSON.stringify(queueRef.current));
    } catch {
      queueRef.current = queueRef.current.filter((event) => event !== item);
      setSaveStatus("Device storage unavailable. Activity was not recorded.");
      return;
    }
    setPendingCount(queueRef.current.length);
    setPendingTypes(queueRef.current.map((event) => event.event_type));
    setSaveStatus("Saving…");
    void flushQueue();
  }

  const [isShiftPending, startShiftTransition] =
    useTransition();

  const [totalIceSeconds, setTotalIceSeconds] =
    useState(0);
  const [currentShiftSeconds, setCurrentShiftSeconds] =
    useState(0);

  const activeShift =
    shifts.find((shift) => shift.ended_at === null) ?? null;

  const isOnIce = activeShift !== null;

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

      if (shift.clock_version === 2) {
        return total + shift.elapsed_seconds;
      }

      const started = new Date(shift.started_at).getTime();
      const ended = new Date(shift.ended_at).getTime();

      return (
        total +
        Math.max(0, Math.floor((ended - started) / 1000))
      );
    }, 0);

    const timer = window.setTimeout(() => {
      setTotalIceSeconds(completedSeconds);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [shifts]);

  useEffect(() => {
    if (!activeShift) {
      const timer = window.setTimeout(() => {
        setCurrentShiftSeconds(0);
      }, 0);

      return () => window.clearTimeout(timer);
    }

    function updateTimer() {
      if (!activeShift) return;

      if (activeShift.clock_version !== 2) {
        const startedAtMs = new Date(
          activeShift.started_at,
        ).getTime();

        setCurrentShiftSeconds(
          Math.max(
            0,
            Math.floor((Date.now() - startedAtMs) / 1000),
          ),
        );

        return;
      }

      const savedSeconds = activeShift.elapsed_seconds;

      if (
        !activeShift.clock_running ||
        !activeShift.clock_started_at
      ) {
        setCurrentShiftSeconds(savedSeconds);
        return;
      }

      const runningSeconds = Math.max(
        0,
        Math.floor(
          (Date.now() -
            new Date(activeShift.clock_started_at).getTime()) /
            1000,
        ),
      );

      setCurrentShiftSeconds(savedSeconds + runningSeconds);
    }

    updateTimer();

    if (
      activeShift.clock_version === 2 &&
      !activeShift.clock_running
    ) {
      return;
    }

    const timer = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(timer);
  }, [activeShift]);

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
        ? "border-emerald-700 bg-emerald-950/80 text-emerald-200 active:bg-emerald-800"
        : impact === "negative"
          ? "border-rose-800 bg-rose-950/70 text-rose-200 active:bg-rose-800"
          : "border-slate-600 bg-slate-800 text-slate-100 active:bg-slate-700";

    return (
      <form onSubmit={(event) => {
        event.preventDefault();
        recordEvent(new FormData(event.currentTarget));
      }}>
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

        <button type="submit" disabled={pendingTypes.includes(eventType)} aria-busy={pendingTypes.includes(eventType)}
          className={`min-h-14 w-full rounded-xl border px-2 py-2 text-sm font-bold transition-colors disabled:opacity-70 ${impactClass}`}>
          {pendingTypes.includes(eventType) ? <span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving…</span> : label}
        </button>
      </form>
    );
  }

  return (
    <div className="mt-4 rounded-2xl bg-[#09182d] p-3 text-slate-100 shadow-xl ring-1 ring-slate-700/60">
      {(pendingCount > 0 || saveStatus) && (
        <div role="status" className="mt-2 px-1 text-xs text-slate-300">
          {pendingCount ? `${pendingCount} activity ${pendingCount === 1 ? "entry" : "entries"} waiting to save. ` : ""}{saveStatus}
          {pendingCount > 0 && <button type="button" onClick={() => void flushQueue()} className="ml-2 font-bold text-sky-300">Retry</button>}
        </div>
      )}

      {/* Time on Ice */}
      <section className="mt-2 rounded-xl border border-slate-700 bg-[#162943] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Time on Ice
            </div>

            <div className="mt-1 text-3xl font-bold tabular-nums">
              {formatTime(
                totalIceSeconds +
                  (isOnIce ? currentShiftSeconds : 0),
              )}
            </div>

            {isOnIce && (
              <div className="mt-1 text-xs font-semibold text-emerald-300">
                Current shift {formatTime(currentShiftSeconds)}
              </div>
            )}
          </div>

        {isOnIce && activeShift?.clock_version === 2 && (
          <form
            action={(formData) => {
              startShiftTransition(async () => {
                await setShiftClock(formData);
              });
            }}
          >
            <input type="hidden" name="shift_id" value={activeShift.id} />
            <input
              type="hidden"
              name="command"
              value={activeShift.clock_running ? "stop" : "start"}
            />

            <button
              type="submit"
              disabled={isShiftPending}
              className="w-full rounded-xl bg-slate-600 px-3 py-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {isShiftPending
                ? "UPDATING CLOCK..."
                : activeShift.clock_running
                  ? "STOP CLOCK"
                  : "START CLOCK"}
            </button>
          </form>
        )}

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
              className="min-h-14 rounded-xl border border-rose-600 bg-rose-950 px-4 py-2 font-bold text-rose-200 disabled:opacity-50"
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
              className="min-h-14 rounded-xl border border-emerald-600 bg-emerald-950 px-4 py-2 font-bold text-emerald-200 disabled:opacity-50"
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
                  ? "border-sky-200 bg-sky-100 text-slate-950"
                  : "border-slate-600 bg-slate-800 text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* Scoring contributions and goals against */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">Scoring</h2>
        <div className="grid grid-cols-2 gap-2">
          {eventButton("Scored Goal", "goal", "positive")}
          {eventButton("On Ice — GA", "goal_against", "negative")}
          {eventButton("Got Assist", "assist", "positive")}
          {eventButton("Responsible — GA", "goal_against_responsible", "negative")}
          {eventButton("Line Goal", "goal_for", "positive")}
          <div aria-hidden="true" />
        </div>
      </section>

      {/* Shot accuracy and positive offensive contributions */}
      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">Offensive Activity & Shot Accuracy</h2>
        <div className="grid grid-cols-2 gap-2">
          {eventButton("SOG", "sog", "positive")}
          {eventButton("Missed Shot", "missed_shot", "neutral")}
          {eventButton("Pass", "pass", "positive")}
          {position === "forward" ? eventButton("Break Away", "breakaway", "positive") : <div aria-hidden="true" />}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">On-Ice Impact</h2>
        <div className="grid grid-cols-2 gap-2">
          {eventButton("Takeaway", "takeaway", "positive")}
          {eventButton("Turnover", "turnover", "negative")}
          {eventButton("Good Forecheck", "good_forecheck", "positive")}
          {eventButton("Penalty", "penalty", "negative")}
          {eventButton("Good Backcheck", "good_backcheck", "positive")}
          {eventButton("Icing", "icing", "negative")}
          {eventButton("Blocked Shot", "blocked_shot", "positive")}
          {eventButton("Off Sides", "offside", "negative")}
          {eventButton("Body Check", "body_check", "positive")}
          {position === "defense" ? eventButton("Burned", "burned", "negative") : <div aria-hidden="true" />}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">Observations</h2>
        <GameNoteButtons recordEvent={recordEvent} period={period} />
      </section>
    </div>
  );
}
