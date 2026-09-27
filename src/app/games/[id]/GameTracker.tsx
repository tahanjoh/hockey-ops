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
}: Props) {
  const [period, setPeriod] = useState(1);
  const router = useRouter();
  const queueKey = `hockey-pending-events-${gameId}`;
  const queueRef = useRef<QueuedEvent[]>([]);
  const flushingRef = useRef(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [saveStatus, setSaveStatus] = useState("");

  const flushQueue = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length) {
        const item = queueRef.current[0];
        const formData = new FormData();
        for (const [key, value] of Object.entries(item)) formData.set(key, String(value));
        try {
          await addEvent(formData);
        } catch {
          setSaveStatus("Not saved yet. Check connection and retry.");
          break;
        }
        queueRef.current = queueRef.current.filter(
          (queued) => queued.client_event_id !== item.client_event_id,
        );
        localStorage.setItem(queueKey, JSON.stringify(queueRef.current));
        setPendingCount(queueRef.current.length);
        setSaveStatus(queueRef.current.length ? "Saving…" : "Saved");
        router.refresh();
      }
    } finally {
      flushingRef.current = false;
    }
  }, [addEvent, queueKey, router]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(queueKey) || "[]");
      queueRef.current = Array.isArray(saved) ? saved : [];
      setPendingCount(queueRef.current.length);
      if (queueRef.current.length) void flushQueue();
    } catch {
      setSaveStatus("Could not read saved activity on this device.");
    }
    const retry = () => void flushQueue();
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [queueKey, flushQueue]);

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
    setSaveStatus("Saving…");
    void flushQueue();
  }

  const [wakeLockStatus, setWakeLockStatus] = useState<
    "active" | "inactive" | "unsupported"
  >("inactive");

  async function activateScreenAwake() {
    if (!("wakeLock" in navigator)) {
      setWakeLockStatus("unsupported");
      return;
    }

    try {
      await navigator.wakeLock.request("screen");
      setWakeLockStatus("active");
    } catch {
      setWakeLockStatus("inactive");
    }
  }


  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function requestWakeLock() {
      if (!("wakeLock" in navigator)) {
        setWakeLockStatus("unsupported");
        return;
      }

      try {
        const lock = await navigator.wakeLock.request("screen");

        if (cancelled) {
          await lock.release();
          return;
        }

        wakeLock = lock;
        setWakeLockStatus("active");

        lock.addEventListener("release", () => {
          setWakeLockStatus("inactive");
        });
      } catch {
        setWakeLockStatus("inactive");
      }
    }

    void requestWakeLock();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      cancelled = true;

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      if (wakeLock) {
        void wakeLock.release();
      }
    };
  }, []);

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
        ? "border-green-600 bg-green-50 text-green-800"
        : impact === "negative"
          ? "border-red-500 bg-red-50 text-red-700"
          : "border-gray-300 bg-white text-gray-900";

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

        <button type="submit" className={`min-h-14 w-full rounded-xl border-2 px-2 py-2 text-sm font-bold ${impactClass}`}>{label}</button>
      </form>
    );
  }

  return (
    <>
      {/* Screen Awake */}
      <section className="mt-4 flex items-center justify-between gap-3 rounded-2xl border bg-gray-50 p-4">
        <div>
          <div className="text-sm font-bold">
            Keep Screen Awake
          </div>

          <div className="mt-1 text-xs text-gray-600">
            {wakeLockStatus === "active"
              ? "Screen will stay on while tracking."
              : wakeLockStatus === "unsupported"
                ? "Not supported on this device."
                : "Screen awake is not active."}
          </div>
        </div>

        {wakeLockStatus === "active" ? (
          <span className="rounded-full bg-green-100 px-3 py-2 text-xs font-bold text-green-800">
            ON
          </span>
        ) : (
          <button
            type="button"
            onClick={activateScreenAwake}
            disabled={wakeLockStatus === "unsupported"}
            className="min-h-11 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {wakeLockStatus === "unsupported"
              ? "Unavailable"
              : "Activate"}
          </button>
        )}
      </section>

      {(pendingCount > 0 || saveStatus) && (
        <div role="status" className="mt-2 px-1 text-xs text-gray-600">
          {pendingCount ? `${pendingCount} activity ${pendingCount === 1 ? "entry" : "entries"} waiting to save. ` : ""}{saveStatus}
          {pendingCount > 0 && <button type="button" onClick={() => void flushQueue()} className="ml-2 font-bold text-blue-700">Retry</button>}
        </div>
      )}

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
              className="w-full rounded-xl bg-slate-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
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
          recordEvent={recordEvent}
          period={period}
        />
      </section>
    </>
  );
}
