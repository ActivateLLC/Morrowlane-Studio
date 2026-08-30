export function nowIso(): string {
  return new Date().toISOString();
}

export function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function startOfUtcDay(iso: string): string {
  const date = new Date(iso);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Inclusive list of ISO day keys covering `days` starting at `startIso`. */
export function dayRange(startIso: string, days: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < days; i += 1) out.push(dayKey(addDays(startIso, i)));
  return out;
}

export function atHour(dayIso: string, hour: number, minute = 0): string {
  const date = new Date(`${dayKey(dayIso)}T00:00:00.000Z`);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}
