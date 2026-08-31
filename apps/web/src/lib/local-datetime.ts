/**
 * `datetime-local` inputs speak the viewer's wall clock. Appending "Z" to that value
 * declared it UTC, so a user who typed 9:00 scheduled a post for 9:00 UTC — the middle
 * of the night in the Americas. `new Date(value)` without the suffix parses it in the
 * browser's own zone, which is what the user meant.
 */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

/** The inverse: a stored UTC instant as the local wall-clock string the input expects. */
export function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
