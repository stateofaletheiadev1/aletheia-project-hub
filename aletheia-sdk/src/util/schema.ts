// A small runtime validator for node responses (wallet prompt 12.4: "never trust shapes").
// Hand-written so it costs a few hundred bytes, not a dependency.

export class SchemaError extends Error {
  override name = "SchemaError";
}

export type Validator<T> = (value: unknown, path: string) => T;
export type Infer<V> = V extends Validator<infer T> ? T : never;

const fail = (path: string, expected: string, value: unknown): never => {
  const seen = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  throw new SchemaError(`${path || "response"}: expected ${expected}, got ${seen}`);
};

export const string: Validator<string> = (value, path) =>
  typeof value === "string" ? value : fail(path, "string", value);

export const boolean: Validator<boolean> = (value, path) =>
  typeof value === "boolean" ? value : fail(path, "boolean", value);

/** A non-negative safe integer (heights, nonces, slots, EU). */
export const count: Validator<number> = (value, path) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : fail(path, "non-negative integer", value);

/** A decimal string of base units, as the node writes every u128. */
export const units: Validator<string> = (value, path) =>
  typeof value === "string" && /^\d{1,39}$/.test(value) ? value : fail(path, "decimal string", value);

export function literal<const T extends string>(...options: T[]): Validator<T> {
  return (value, path) => (options.includes(value as T) ? (value as T) : fail(path, options.join(" | "), value));
}

export function nullable<T>(inner: Validator<T>): Validator<T | null> {
  return (value, path) => (value === null ? null : inner(value, path));
}

export function optional<T>(inner: Validator<T>): Validator<T | undefined> {
  return (value, path) => (value === undefined ? undefined : inner(value, path));
}

export function array<T>(inner: Validator<T>): Validator<T[]> {
  return (value, path) =>
    Array.isArray(value) ? value.map((item, i) => inner(item, `${path}[${i}]`)) : fail(path, "array", value);
}

export function object<S extends Record<string, Validator<unknown>>>(
  shape: S,
): Validator<{ [K in keyof S]: Infer<S[K]> }> {
  return (value, path) => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return fail(path, "object", value);
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) out[key] = shape[key]!(record[key], path ? `${path}.${key}` : key);
    return out as { [K in keyof S]: Infer<S[K]> };
  };
}

export function parse<T>(validator: Validator<T>, value: unknown): T {
  return validator(value, "");
}
