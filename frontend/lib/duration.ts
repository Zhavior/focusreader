/**
 * Listening-time estimates for the time-blindness features. Spoken English
 * TTS averages ~950 characters per minute at 1.0x speed.
 */
const CHARS_PER_MINUTE = 950;

export function estimateSeconds(chars: number, speed = 1.0): number {
  if (chars <= 0) return 0;
  const effectiveSpeed = speed > 0 ? speed : 1.0;
  return (chars / CHARS_PER_MINUTE / effectiveSpeed) * 60;
}

/** "45s", "12 min", "1h 05m" — compact, glanceable. */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h ${String(rest).padStart(2, "0")}m`;
}

export function estimateLabel(chars: number, speed = 1.0): string {
  return formatDuration(estimateSeconds(chars, speed));
}
