"use client";

import { useState } from "react";

type NoteType =
  | "positive_note"
  | "improvement_note"
  | "quick_note";

type Props = {
  addEvent: (formData: FormData) => void | Promise<void>;
  period: number;
};

export default function GameNoteButtons({
  addEvent,
  period,
}: Props) {
  const [activeType, setActiveType] =
    useState<NoteType | null>(null);

  const [noteText, setNoteText] = useState("");

  function openNote(type: NoteType) {
    setActiveType(type);
    setNoteText("");
  }

  function closeNote() {
    setActiveType(null);
    setNoteText("");
  }

  const title =
    activeType === "positive_note"
      ? "Positive Note"
      : activeType === "improvement_note"
        ? "Improvement Note"
        : "Quick Note";

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() =>
            openNote("positive_note")
          }
          className="min-h-14 rounded-2xl border px-3 font-bold"
        >
          + Positive
        </button>

        <button
          type="button"
          onClick={() =>
            openNote("improvement_note")
          }
          className="min-h-14 rounded-2xl border px-3 font-bold"
        >
          + Improvement
        </button>
      </div>

      <button
        type="button"
        onClick={() =>
          openNote("quick_note")
        }
        className="mt-3 min-h-14 w-full rounded-2xl border px-3 font-bold"
      >
        + Quick Note
      </button>

      {activeType && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <div className="w-full rounded-t-3xl bg-white p-5">
            <div className="mx-auto max-w-md">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">
                  {title}
                </h3>

                <button
                  type="button"
                  onClick={closeNote}
                  className="text-sm font-semibold text-gray-500"
                >
                  Cancel
                </button>
              </div>

              <form
                action={async (formData) => {
                  await addEvent(formData);
                  closeNote();
                }}
                className="mt-4"
              >
                <input
                  type="hidden"
                  name="event_type"
                  value={activeType}
                />

                <input
                  type="hidden"
                  name="period"
                  value={period}
                />

                <textarea
                  name="note_text"
                  value={noteText}
                  onChange={(e) =>
                    setNoteText(e.target.value)
                  }
                  rows={3}
                  autoFocus
                  placeholder="Add a quick note..."
                  className="w-full rounded-2xl border px-4 py-3"
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="submit"
                    onClick={() =>
                      setNoteText("")
                    }
                    className="min-h-14 rounded-2xl border font-semibold"
                  >
                    Save Without Note
                  </button>

                  <button
                    type="submit"
                    className="min-h-14 rounded-2xl bg-black font-semibold text-white"
                  >
                    Save Note
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}