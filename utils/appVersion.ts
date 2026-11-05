// Decides whether to ask someone to update the app. Kept apart from the hook
// that shows the alert (hooks/useUpdatePrompt.ts) so it has no React Native
// imports and can be checked on its own.

/** How long "Not now" or "Update" holds the question back. */
export const UPDATE_PROMPT_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * True when `latest` is a higher version than `installed`, comparing each
 * number in turn: 1.0.11 is newer than 1.0.10, and 1.1 than 1.0.9. Anything
 * that isn't a plain version (missing, empty, "1.0.x") is never newer, so a
 * bad value can only mean no question, never a wrong one.
 */
export function isNewerVersion(latest: unknown, installed: unknown): boolean {
  const parse = (v: unknown) =>
    typeof v === "string" && /^\d+(\.\d+)*$/.test(v)
      ? v.split(".").map(Number)
      : null;
  const a = parse(latest);
  const b = parse(installed);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

/**
 * Whether to ask now. `snoozedUntil` is the time saved on the phone by the
 * last answer (null when never asked).
 */
export function shouldAskToUpdate({
  latest,
  installed,
  snoozedUntil,
  now,
}: {
  latest: unknown;
  installed: unknown;
  snoozedUntil: number | null;
  now: number;
}): boolean {
  if (snoozedUntil !== null && snoozedUntil > now) return false;
  return isNewerVersion(latest, installed);
}
