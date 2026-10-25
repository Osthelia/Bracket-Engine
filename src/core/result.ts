// Validation outcome shared by the pure checks. A code is a stable id the caller translates, the path points at the faulty field.
export interface CoreError {
  code: string;
  path: string;
  params?: Record<string, string | number>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: CoreError[] };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (...errors: CoreError[]): Result<never> => ({ ok: false, errors });
