// Four digits represent MMSS: 0125 -> 01:25. A colon is display-only.
export function formatClockDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

export function normalizeClock(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length > 4) return null;
  const padded = digits.padStart(4, "0");
  const minutes = padded.slice(0, 2);
  const seconds = padded.slice(2);
  return Number(seconds) < 60 ? `${minutes}:${seconds}` : null;
}
