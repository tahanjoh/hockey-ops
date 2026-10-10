"use client";

import { useState, useTransition } from "react";

export default function ActivityVideo({ initialUrl, saveVideo }: {
  initialUrl: string | null;
  saveVideo: (formData: FormData) => Promise<void>;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? "");
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <div className="mt-2 text-xs">
      {savedUrl && <a href={savedUrl} target="_blank" rel="noopener noreferrer" className="mr-3 inline-block py-1 font-semibold text-blue-700">Watch Play ↗</a>}
      {!editing ? <button type="button" onClick={() => { setUrl(savedUrl); setMessage(""); setEditing(true); }} className="py-1 font-semibold text-blue-700">{savedUrl ? "Edit Video" : "+ Add Video"}</button> : (
        <form onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            try {
              await saveVideo(data);
              setSavedUrl(String(data.get("video_url") || "").trim());
              setEditing(false);
              setMessage("Saved");
            } catch {
              setMessage("Could not save. Check the link and try again.");
            }
          });
        }}>
          <label className="block">Video link for this activity</label>
          <input type="url" name="video_url" aria-label="Video link for this activity" placeholder="https://…" value={url} onChange={(event) => setUrl(event.target.value)} disabled={pending} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" />
          <div className="mt-2 flex gap-3">
            <button type="submit" disabled={pending} className="font-semibold text-blue-700">{pending ? "Saving…" : "Save"}</button>
            <button type="button" disabled={pending} onClick={() => setEditing(false)}>Cancel</button>
          </div>
          <p className="mt-1 text-gray-500">Clear and save to remove the link.</p>
        </form>
      )}
      {message && <p role="status" className="mt-1 text-gray-600">{message}</p>}
    </div>
  );
}
