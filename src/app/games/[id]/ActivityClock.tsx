"use client";

import { useState, useTransition } from "react";
import { formatClockDraft, normalizeClock } from "./clockFormat";

type Props = {
  eventId: string;
  initialTime: string | null;
  updateEventClock: (formData: FormData) => Promise<void>;
};

export default function ActivityClock({ eventId, initialTime, updateEventClock }: Props) {
  const [value, setValue] = useState(normalizeClock(initialTime ?? "") ?? "");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return editing ? (
    <form className="mt-1 flex items-center gap-1" onSubmit={(event) => {
      event.preventDefault();
      const normalized = normalizeClock(value);
      if (normalized === null) {
        setError("Use MM:SS (seconds 00–59)");
        return;
      }
      setValue(normalized);
      const formData = new FormData();
      formData.set("event_id", eventId);
      formData.set("clock_time", normalized);
      startTransition(async () => {
        try {
          await updateEventClock(formData);
          setError("");
          setEditing(false);
        } catch {
          setError("Save failed. Try again.");
        }
      });
    }}>
      <input aria-label="Game clock MM:SS" inputMode="numeric" placeholder="00:00" maxLength={5}
        value={value} onChange={(event) => setValue(formatClockDraft(event.target.value))}
        onBlur={() => { const normalized = normalizeClock(value); if (normalized !== null) setValue(normalized); }}
        className="w-16 rounded border px-1 py-1 text-sm tabular-nums" />
      <button type="submit" disabled={pending} className="font-semibold text-blue-700 disabled:opacity-50">
        {pending ? "Saving" : "Save"}
      </button>
      {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
    </form>
  ) : (
    <button type="button" onClick={() => setEditing(true)}
      className="block text-left text-xs font-semibold text-blue-700">
      {value ? `Clock ${value} · Edit` : "+ Clock time"}
    </button>
  );
}
