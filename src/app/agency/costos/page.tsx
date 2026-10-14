export const dynamic = "force-dynamic";

import Link from "next/link";
import { requireAgency } from "@/server/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageTitle, TopBar } from "@/components/Shell";
import { FIXED_MONTHLY, PRICES } from "@/lib/usage";
import { fmtDateTime, TIME_ZONE } from "@/lib/time";

const USD_MXN = Number(process.env.USD_MXN ?? 18.5);
const usd = (n: number, d = 2) => `$${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const mxn = (n: number) => `$${Math.round(n * USD_MXN).toLocaleString("es-MX")} MXN`;
const gb = (bytes: number) => bytes / 1024 ** 3;

const KIND_LABEL: Record<string, string> = { claude: "Claude (IA)", apify: "Apify (redes y Google)", gemini: "Imágenes (flyers)", render: "Renders" };

function monthRange(mes?: string) {
  const now = new Date();
  const [y, m] = mes && /^\d{4}-\d{2}$/.test(mes) ? mes.split("-").map(Number) : [now.getUTCFullYear(), now.getUTCMonth() + 1];
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    start,
    end,
    label: start.toLocaleDateString("es-MX", { month: "long", year: "numeric", timeZone: "UTC" }),
    prev: key(new Date(Date.UTC(y, m - 2, 1))),
    next: key(end),
    isCurrent: key(start) === key(now),
  };
}

export default async function CostosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requireAgency();
  const { mes } = await searchParams;
  const r = monthRange(mes);
  const db = supabaseAdmin();

  const [{ data: events, error }, { data: clients }, { data: edits }, { data: flyers }, storage] = await Promise.all([
    db.from("usage_events").select("*").gte("created_at", r.start.toISOString()).lt("created_at", r.end.toISOString()).order("created_at", { ascending: false }).limit(5000),
    db.from("clients").select("id, name"),
    db.from("edits").select("client_id, status, updated_at").eq("status", "done").gte("updated_at", r.start.toISOString()).lt("updated_at", r.end.toISOString()),
    db.from("flyers").select("client_id, status, created_at").eq("status", "done").gte("created_at", r.start.toISOString()).lt("created_at", r.end.toISOString()),
    db.rpc("storage_usage_by_client"),
  ]);

  if (error) {
    return (
      <>
        <TopBar right={<Link href="/agency" className="btn btn-ghost !py-1.5 text-xs">← Clientes</Link>} />
        <main className="mx-auto max-w-5xl px-5 py-10">
          <PageTitle kicker="Agencia" title="Costos" />
          <div className="card p-6 text-sm text-muted">Falta activar el registro de costos en la base de datos (migración 0010).</div>
        </main>
      </>
    );
  }

  const ev = events ?? [];
  const byKind = (k: string) => ev.filter((e) => e.kind === k).reduce((a, e) => a + Number(e.cost_usd), 0);
  const claude = byKind("claude");
  const apify = byKind("apify");
  const gemini = byKind("gemini");
  const renders = ev.filter((e) => e.kind === "render").length;

  // fijos con sus créditos: Apify trae 19 USD de crédito; Remotion cobra 0.01 por render con mínimo mensual
  const fixed = FIXED_MONTHLY.map((f) => {
    const plan = f.usd ? "" : "Plan gratis · ";
    // en el plan gratis de Apify el uso se paga aparte después de 5 USD de crédito
    if (f.credit === "apify") return { ...f, charged: f.usd ? Math.max(f.usd, apify) : Math.max(0, apify - 5), note: `${plan}${usd(apify)} de uso este mes · ${f.paidHint}` };
    if (f.credit === "render") return { ...f, charged: f.usd ? Math.max(f.usd, renders * PRICES.render) : 0, note: `${plan}${renders} renders · ${f.paidHint}` };
    return { ...f, charged: f.usd, note: `${plan}${f.paidHint}` };
  });
  const fixedTotal = fixed.reduce((a, f) => a + f.charged, 0);
  const apifyPaid = FIXED_MONTHLY.some((f) => f.credit === "apify" && f.usd > 0);
  const total = fixedTotal + claude + gemini; // apify y renders ya van dentro de sus renglones fijos

  // almacenamiento
  const st = (storage.data ?? []) as { client_folder: string; bucket: string; bytes: number; files: number }[];
  const storageBytes = st.reduce((a, s) => a + Number(s.bytes), 0);
  const storageOver = Math.max(0, gb(storageBytes) - 100) * 0.021;
  const egressEstimateGb = renders * 1.5;

  const names = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const ids = new Set<string>([
    ...ev.map((e) => e.client_id).filter(Boolean),
    ...(edits ?? []).map((e) => e.client_id),
    ...(flyers ?? []).map((f) => f.client_id),
  ]);
  const activeClients = Math.max(1, ids.size);
  const fixedShare = fixedTotal / activeClients;
  const rows = [...ids]
    .map((id) => {
      const mine = ev.filter((e) => e.client_id === id);
      const sum = (k: string) => mine.filter((e) => e.kind === k).reduce((a, e) => a + Number(e.cost_usd), 0);
      const variable = mine.reduce((a, e) => a + Number(e.cost_usd), 0);
      const videos = (edits ?? []).filter((e) => e.client_id === id).length;
      const fl = (flyers ?? []).filter((f) => f.client_id === id).length;
      const bytes = st.filter((s) => s.client_folder === id).reduce((a, s) => a + Number(s.bytes), 0);
      return { id, name: names.get(id) ?? "Cliente borrado", claude: sum("claude"), apify: sum("apify"), gemini: sum("gemini"), renders: mine.filter((e) => e.kind === "render").length, variable, videos, flyers: fl, bytes };
    })
    .sort((a, b) => b.variable - a.variable);
  const unassigned = ev.filter((e) => !e.client_id).reduce((a, e) => a + Number(e.cost_usd), 0);

  return (
    <>
      <TopBar right={<Link href="/agency" className="btn btn-ghost !py-1.5 text-xs">← Clientes</Link>} />
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
        <PageTitle kicker="Solo agencia" title="Costos">
          <Link href={`/agency/costos?mes=${r.prev}`} className="btn btn-ghost">←</Link>
          <span className="btn btn-ghost pointer-events-none capitalize">{r.label}</span>
          {!r.isCurrent ? <Link href={`/agency/costos?mes=${r.next}`} className="btn btn-ghost">→</Link> : null}
        </PageTitle>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-5">
            <div className="label">Total del mes</div>
            <div className="mt-2 text-3xl font-extrabold">{usd(total)}</div>
            <div className="text-sm text-muted">{mxn(total)}</div>
          </div>
          <div className="card p-5">
            <div className="label">Fijos</div>
            <div className="mt-2 text-3xl font-extrabold">{usd(fixedTotal)}</div>
            <div className="text-sm text-muted">Repartidos: {usd(fixedShare)} por cliente activo ({activeClients})</div>
          </div>
          <div className="card p-5">
            <div className="label">IA (Claude + imágenes)</div>
            <div className="mt-2 text-3xl font-extrabold">{usd(claude + gemini)}</div>
            <div className="text-sm text-muted">{ev.filter((e) => e.kind === "claude").length} llamadas · {ev.filter((e) => e.kind === "gemini").length} imágenes</div>
          </div>
          <div className="card p-5">
            <div className="label">Videos exportados</div>
            <div className="mt-2 text-3xl font-extrabold">{renders}</div>
            <div className="text-sm text-muted">
              {renders ? `${usd(total / renders)} por video con todo incluido` : "Todavía sin renders este mes"}
            </div>
          </div>
        </div>

        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">Por cliente</h2>
          <table className="w-full min-w-[820px] text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead className="text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2">Cliente</th>
                <th className="text-right">Claude</th>
                <th className="text-right">Apify</th>
                <th className="text-right">Imágenes</th>
                <th className="text-right">Renders</th>
                <th className="text-right">Variable</th>
                <th className="text-right">Con fijos</th>
                <th className="text-right">Videos</th>
                <th className="text-right">Flyers</th>
                <th className="text-right">Espacio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="py-2.5 font-semibold"><Link href={`/c/${c.id}`} className="hover:text-purple">{c.name}</Link></td>
                  <td className="text-right">{usd(c.claude)}</td>
                  <td className="text-right">{usd(c.apify)}</td>
                  <td className="text-right">{usd(c.gemini)}</td>
                  <td className="text-right">{c.renders}</td>
                  <td className="text-right font-semibold">{usd(c.variable)}</td>
                  <td className="text-right">{usd(c.variable - (apifyPaid ? c.apify : 0) - c.renders * PRICES.render + fixedShare)}</td>
                  <td className="text-right">{c.videos}</td>
                  <td className="text-right">{c.flyers}</td>
                  <td className="text-right">{gb(c.bytes).toFixed(1)} GB</td>
                </tr>
              ))}
              {unassigned > 0 ? (
                <tr className="border-t border-line text-muted">
                  <td className="py-2.5">Sin cliente (pruebas)</td>
                  <td colSpan={4} />
                  <td className="text-right">{usd(unassigned)}</td>
                  <td colSpan={4} />
                </tr>
              ) : null}
              {!rows.length ? (
                <tr><td colSpan={10} className="py-6 text-center text-muted">Todavía no hay gastos registrados este mes.</td></tr>
              ) : null}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            “Con fijos” = lo que gastó en Claude e imágenes + su parte de los fijos (Apify y renders ya están dentro de sus planes fijos).
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Fijos del mes</h2>
            <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
              <tbody>
                {fixed.map((f) => (
                  <tr key={f.name} className="border-t border-line first:border-0">
                    <td className="py-2">{f.name}<div className="text-xs text-muted">{f.note}</div></td>
                    <td className="text-right font-semibold">{usd(f.charged)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="card p-5">
            <h2 className="mb-3 font-bold">Almacenamiento y descarga</h2>
            <div className="space-y-3 text-sm">
              <div>
                <div className="flex justify-between"><span>Espacio usado (todos los clientes)</span><b>{gb(storageBytes).toFixed(1)} GB de 100 GB incluidos</b></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
                  <div className="h-full bg-purple" style={{ width: `${Math.min(100, gb(storageBytes))}%` }} />
                </div>
                {storageOver > 0 ? <div className="mt-1 text-xs text-warn">Extra estimado: {usd(storageOver)} al mes</div> : null}
              </div>
              <div>
                <div className="flex justify-between"><span>Descarga estimada (egress)</span><b>~{egressEstimateGb.toFixed(0)} GB de 250 GB incluidos</b></div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-cream">
                  <div className="h-full bg-peach" style={{ width: `${Math.min(100, (egressEstimateGb / 250) * 100)}%` }} />
                </div>
                <div className="mt-1 text-xs text-muted">Estimado a 1.5 GB por video exportado. El dato exacto está en Supabase → Usage.</div>
              </div>
            </div>
          </section>
        </div>

        <section className="card overflow-x-auto p-5">
          <h2 className="mb-3 font-bold">Últimos gastos</h2>
          <table className="w-full min-w-[640px] text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <tbody>
              {ev.slice(0, 40).map((e) => (
                <tr key={e.id} className="border-t border-line first:border-0">
                  <td className="py-2 text-muted">{fmtDateTime(e.created_at)}</td>
                  <td>{e.client_id ? names.get(e.client_id) ?? "Cliente borrado" : "Sin cliente"}</td>
                  <td><span className="chip">{KIND_LABEL[e.kind] ?? e.kind}</span></td>
                  <td>{e.detail}</td>
                  <td className="text-right font-semibold">{usd(Number(e.cost_usd), 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-muted">
          Precios de lista en USD: Claude Sonnet {PRICES.claude["claude-sonnet-5-5"][0]}/{PRICES.claude["claude-sonnet-5-5"][1]} por millón de tokens,
          Apify por resultado, imagen 2K {usd(PRICES.geminiImage["2K"], 3)}. Los fijos salen en 0 mientras estés en planes gratis: cuando
          pases a uno de pago, agrega su precio en Vercel (COST_VERCEL, COST_SUPABASE, COST_APIFY, COST_REMOTION). Pesos a {USD_MXN} por dólar (cámbialo con
          USD_MXN en Vercel). Zona horaria: {TIME_ZONE}. Los gastos se registran desde que se activó este panel.
        </p>
      </main>
    </>
  );
}
