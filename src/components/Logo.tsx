export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="grid place-items-center rounded-full border border-lavender/40 text-lavender glow"
        style={{ width: small ? 34 : 42, height: small ? 34 : 42, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: small ? 18 : 22 }}
      >
        R
      </div>
      <div className="leading-tight">
        <div className="display text-[13px] text-white">Roots Engine</div>
        {!small && <div className="text-[10px] tracking-[0.3em] text-muted uppercase">Purple Roots Agency</div>}
      </div>
    </div>
  );
}
