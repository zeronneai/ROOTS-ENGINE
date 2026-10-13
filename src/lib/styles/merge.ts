export type DeepPartial<T> = T extends unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Merge profundo; arrays y primitivos se reemplazan, undefined se ignora. */
export function deepMerge<T>(base: T, ...patches: unknown[]): T {
  let out: unknown = structuredClone(base);
  for (const patch of patches) {
    out = mergeOne(out, patch);
  }
  return out as T;
}

function mergeOne(a: unknown, b: unknown): unknown {
  if (b === undefined || b === null) return a;
  if (!isPlainObject(a) || !isPlainObject(b)) return b;
  const res: Record<string, unknown> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    res[k] = mergeOne(a[k], v);
  }
  return res;
}
