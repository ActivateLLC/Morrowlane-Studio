export type Ok<T> = { ok: true; value: T };
export type Err<E = string> = { ok: false; error: E; cause?: unknown };
export type Result<T, E = string> = Ok<T> | Err<E>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<E = string>(error: E, cause?: unknown): Err<E> {
  return { ok: false, error, cause };
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw new Error(`Attempted to unwrap a failed Result: ${String(result.error)}`);
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}
