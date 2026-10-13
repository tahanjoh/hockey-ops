"use client";

import { useEffect, useRef, useState } from "react";

export default function ScreenAwakeControl() {
  const [status, setStatus] = useState<"active" | "inactive" | "unsupported">("inactive");
  const lockRef = useRef<WakeLockSentinel | null>(null);

  async function activate() {
    if (!("wakeLock" in navigator)) { setStatus("unsupported"); return; }
    try {
      const lock = await navigator.wakeLock.request("screen");
      lockRef.current = lock;
      setStatus("active");
      lock.addEventListener("release", () => {
        if (lockRef.current === lock) { lockRef.current = null; setStatus("inactive"); }
      });
    } catch { setStatus("inactive"); }
  }

  useEffect(() => {
    let mounted = true;
    async function request() {
      if (!("wakeLock" in navigator)) { if (mounted) setStatus("unsupported"); return; }
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!mounted) { await lock.release(); return; }
        lockRef.current = lock;
        setStatus("active");
        lock.addEventListener("release", () => {
          if (lockRef.current === lock && mounted) { lockRef.current = null; setStatus("inactive"); }
        });
      } catch { if (mounted) setStatus("inactive"); }
    }
    void request();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lockRef.current) void request();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mounted = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, []);

  return (
    <div className="mt-2 flex items-center justify-end gap-2 text-[11px] text-slate-300">
      <span>Screen awake</span>
      {status === "active" ? (
        <span className="rounded-full bg-emerald-950 px-2 py-1 font-bold text-emerald-300">ON</span>
      ) : (
        <button type="button" onClick={() => void activate()} disabled={status === "unsupported"}
          className="rounded-lg bg-slate-700 px-3 py-2 font-bold text-white disabled:opacity-50">
          {status === "unsupported" ? "Unavailable" : "Activate"}
        </button>
      )}
    </div>
  );
}
