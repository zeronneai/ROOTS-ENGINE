/* eslint-disable @next/next/no-img-element */

/** Logo real de Purple Roots: monograma PR + wordmark, con "Roots Engine" como producto. */
export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img src="/brand/pr-icon-purple.png" alt="Purple Roots" style={{ height: small ? 30 : 42, width: "auto" }} />
      <div className="flex flex-col gap-1.5 border-l border-line pl-3">
        <img src="/brand/pr-wordmark-purple.png" alt="Purple Roots" style={{ height: small ? 12 : 16, width: "auto" }} />
        <span className="display text-[9px] leading-none text-muted">Roots Engine</span>
      </div>
    </div>
  );
}
