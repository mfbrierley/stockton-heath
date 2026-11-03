/**
 * True when `candidate` is a later version than `current`, comparing each
 * dot-separated number in turn, so "1.0.10" is later than "1.0.9". False when
 * either can't be read: a malformed value must never prompt anyone to update.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parseVersion(candidate);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

function parseVersion(version: string): number[] | null {
  return /^\d+(\.\d+)*$/.test(version) ? version.split(".").map(Number) : null;
}
