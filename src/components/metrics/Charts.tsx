/**
 * Gráficas en SVG simple (sin librerías): se dibujan en el servidor y se ven igual al imprimir.
 */

type Series = { name: string; color: string; values: number[]; kind?: "line" | "bar"; format?: (n: number) => string };

const shortDay = (d: string) => {
  const [, m, dd] = d.split("-");
  return `${Number(dd)}/${Number(m)}`;
};

const nice = (max: number) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const f = max / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n * 10) / 10}`);

/**
 * Serie por día. Hasta 2 series: si son de distinta escala (ej. gasto y resultados),
 * la segunda usa su propio eje a la derecha.
 */
export function TrendChart({ days, series, height = 200, dualAxis = false }: { days: string[]; series: Series[]; height?: number; dualAxis?: boolean }) {
  const W = 720;
  const H = height;
  const pad = { l: 44, r: dualAxis ? 44 : 12, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = Math.max(1, days.length);
  const maxA = nice(Math.max(0, ...series.filter((_, i) => !dualAxis || i === 0).flatMap((s) => s.values)));
  const maxB = dualAxis ? nice(Math.max(0, ...(series[1]?.values ?? [0]))) : maxA;
  const x = (i: number) => pad.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const yOf = (v: number, max: number) => pad.t + ih - (v / max) * ih;
  const step = Math.max(1, Math.ceil(n / 8));
  const barW = Math.max(2, Math.min(22, (iw / n) * 0.6));
  const empty = series.every((s) => s.values.every((v) => !v));

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih * (1 - f)} y2={pad.t + ih * (1 - f)} stroke="#ece9f3" />
            <text x={pad.l - 6} y={pad.t + ih * (1 - f) + 4} fontSize="10" textAnchor="end" fill="#8a86a0">{compact(maxA * f)}</text>
            {dualAxis ? <text x={W - pad.r + 6} y={pad.t + ih * (1 - f) + 4} fontSize="10" fill={series[1]?.color ?? "#8a86a0"}>{compact(maxB * f)}</text> : null}
          </g>
        ))}
        {days.map((d, i) => ((i % step === 0 && n - 1 - i >= step / 2) || i === n - 1 ? <text key={d} x={x(i)} y={H - 8} fontSize="10" textAnchor="middle" fill="#8a86a0">{shortDay(d)}</text> : null))}
        {series.map((s, si) => {
          const max = dualAxis && si === 1 ? maxB : maxA;
          if (s.kind === "bar")
            return (
              <g key={s.name}>
                {s.values.map((v, i) => (
                  <rect key={i} x={x(i) - barW / 2} y={yOf(v, max)} width={barW} height={Math.max(0, pad.t + ih - yOf(v, max))} rx="2" fill={s.color} opacity="0.85">
                    <title>{`${days[i]} · ${s.name}: ${s.format ? s.format(v) : v.toLocaleString("en-US")}`}</title>
                  </rect>
                ))}
              </g>
            );
          const pts = s.values.map((v, i) => `${x(i)},${yOf(v, max)}`).join(" ");
          return (
            <g key={s.name}>
              {si === 0 && !dualAxis ? <polygon points={`${x(0)},${pad.t + ih} ${pts} ${x(n - 1)},${pad.t + ih}`} fill={s.color} opacity="0.08" /> : null}
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {s.values.map((v, i) => (
                <circle key={i} cx={x(i)} cy={yOf(v, max)} r={n > 45 ? 0 : 2.5} fill={s.color}>
                  <title>{`${days[i]} · ${s.name}: ${s.format ? s.format(v) : v.toLocaleString("en-US")}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {empty ? <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#8a86a0">Sin datos en este periodo</text> : null}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Barras horizontales con valor (fuentes, páginas, campañas). */
export function BarList({ items, color = "#4f4789", format }: { items: { name: string; n: number; sub?: string }[]; color?: string; format?: (n: number) => string }) {
  if (!items.length) return <p className="text-sm text-muted">Sin datos todavía.</p>;
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <ul className="space-y-1.5">
      {items.map((x) => (
        <li key={x.name} className="relative overflow-hidden rounded-lg px-3 py-1.5 text-sm">
          <div className="absolute inset-y-0 left-0 rounded-lg" style={{ width: `${Math.max(3, (x.n / max) * 100)}%`, background: color, opacity: 0.14 }} />
          <div className="relative flex justify-between gap-3">
            <span className="truncate">
              {x.name}
              {x.sub ? <span className="ml-1 text-xs text-muted">{x.sub}</span> : null}
            </span>
            <span className="shrink-0 font-mono">{format ? format(x.n) : x.n.toLocaleString("en-US")}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Mini línea para las tarjetas del resumen. */
export function Sparkline({ values, color = "#4f4789" }: { values: number[]; color?: string }) {
  const W = 120;
  const H = 32;
  const max = Math.max(1, ...values);
  const n = Math.max(2, values.length);
  const pts = values.map((v, i) => `${(i / (n - 1)) * W},${H - 2 - (v / max) * (H - 4)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-28" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Número grande con cambio contra el periodo anterior. */
export function Kpi({ label, value, prev, sub, invert = false }: { label: string; value: string; prev?: { cur: number; prev: number } | null; sub?: string; invert?: boolean }) {
  const d = prev && prev.prev ? Math.round(((prev.cur - prev.prev) / prev.prev) * 100) : null;
  const good = d != null && (invert ? d < 0 : d > 0);
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{value}</span>
        {d != null && d !== 0 ? <span className={`text-xs font-semibold ${good ? "text-ok" : "text-bad"}`}>{d > 0 ? "▲" : "▼"} {Math.abs(d)}%</span> : null}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}
