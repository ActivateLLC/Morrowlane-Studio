/** Tiny class joiner. The UI has no need for a full class-merge dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}
