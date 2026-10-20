import Link from "next/link";
import { notFound } from "next/navigation";
import { loadClient } from "@/server/load";
import { PageTitle } from "@/components/Shell";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyText } from "@/components/rebrand/CopyText";
import { GenerateImage } from "@/components/rebrand/GenerateImage";
import { LiveRefresh } from "@/components/rebrand/LiveRefresh";
import { adoptRebrandLogoAction, deleteRebrandAction } from "@/app/flyer-actions";
import { fmtDate } from "@/lib/time";
import type { RebrandData } from "@/lib/ai/rebrand";
import type { RebrandImage } from "@/server/rebrands";

const KIND: Record<RebrandImage["kind"], string> = { logo: "Logo", monogram: "Monograma", mockup: "Mockup" };

const luma = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};
/** Texto oscuro o claro según el fondo. */
const ink = (hex: string) => (luma(hex) > 150 ? "#1f1a19" : "#f7f3ee");

export default async function RebrandPage({ params }: { params: Promise<{ id: string; rid: string }> }) {
  const { id, rid } = await params;
  const { db, isAgency } = await loadClient(id);
  const { data: rb } = await db.from("rebrands").select("*").eq("id", rid).eq("client_id", id).maybeSingle();
  if (!rb) notFound();
  const data = rb.data as RebrandData | null;
  const images = (rb.images ?? []) as RebrandImage[];
  const signed = new Map<string, string>();
  for (const im of images) {
    const { data: s } = await db.storage.from("brand").createSignedUrl(im.path, 60 * 60 * 3);
    if (s?.signedUrl) signed.set(im.path, s.signedUrl);
  }
  const { data: logoRows } = await db.from("brand_assets").select("path").eq("client_id", id).eq("pinned", true).eq("category", "logo");
  const official = new Set((logoRows ?? []).map((r) => r.path));

  // vista previa de las tipografías propuestas (Google Fonts)
  const families = [...new Set((data?.directions ?? []).flatMap((d) => [d.typography.display, d.typography.text]))].filter((f) => /^[A-Za-z0-9 ]{2,40}$/.test(f));
  const fontsHref = families.length
    ? `https://fonts.googleapis.com/css2?${families.map((f) => `family=${f.trim().replace(/ /g, "+")}`).join("&")}&display=swap`
    : null;

  return (
    <>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} precedence="default" /> : null}
      <PageTitle kicker={`✦ Rebranding · ${fmtDate(rb.created_at)}`} title={rb.title}>
        {data ? <PrintButton /> : null}
      </PageTitle>
      <Link href={`/c/${id}/rebranding`} className="-mt-3 mb-5 inline-block text-sm text-muted hover:text-ink print:hidden">← Todos los análisis</Link>

      {rb.status === "generating" ? (
        <div className="card p-6 text-sm text-muted">
          <LiveRefresh /> Analizando la marca y el segmento. Tarda 2 o 3 minutos; esta página se actualiza sola.
        </div>
      ) : null}
      {rb.status === "failed" ? <div className="card p-6 text-sm text-bad">No se pudo terminar: {rb.error}</div> : null}

      {data ? (
        <div className="space-y-8">
          <section className="card space-y-5 p-6">
            <p className="text-lg">{data.summary}</p>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="label">Cómo se ve hoy</div>
                <p className="mt-1 text-sm text-muted">{data.diagnosis.visual}</p>
                <div className="label mt-4">Cómo suena hoy</div>
                <p className="mt-1 text-sm text-muted">{data.diagnosis.verbal}</p>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="label">Vale la pena conservar</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{data.diagnosis.keep.map((x, k) => <li key={k}>{x}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Lo que la frena</div>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">{data.diagnosis.problems.map((x, k) => <li key={k}>{x}</li>)}</ul>
                </div>
              </div>
            </div>
          </section>

          <section className="card overflow-x-auto p-6">
            <h2 className="text-xl font-semibold">El segmento</h2>
            <table className="mt-4 w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-2 pr-4">Marca</th><th className="py-2 pr-4">Posicionamiento</th><th className="py-2 pr-4">Estilo visual</th><th className="py-2 pr-4">Colores</th><th className="py-2">Qué es suyo</th></tr>
              </thead>
              <tbody>
                {data.segment.map((s, k) => (
                  <tr key={k} className="border-t border-line align-top">
                    <td className="py-3 pr-4 font-semibold">{s.name}</td>
                    <td className="py-3 pr-4">{s.positioning}</td>
                    <td className="py-3 pr-4 text-muted">{s.visualStyle}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">{s.colors.length ? s.colors.map((c) => <span key={c} title={c} className="h-5 w-5 rounded-full border border-line" style={{ background: c }} />) : <span className="text-xs text-muted">sin dato</span>}</div>
                    </td>
                    <td className="py-3">{s.owns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="label mt-6">Espacios que nadie ocupa</div>
            <div className="mt-2 flex flex-wrap gap-2">{data.whiteSpace.map((w, k) => <span key={k} className="chip !bg-sun/60">{w}</span>)}</div>
            <p className="mt-3 text-xs text-muted">Los colores de otras marcas son aproximados.</p>
          </section>

          {data.names.length ? (
            <section className="card p-6">
              <h2 className="text-xl font-semibold">Nombres propuestos</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.names.map((n, k) => (
                  <div key={k} className="rounded-xl border border-line p-4">
                    <div className="text-lg font-semibold">{n.name}</div>
                    <p className="mt-1 text-sm text-muted">{n.why}</p>
                    <p className="mt-2 text-xs text-lavender">Revisar: {n.check}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {data.directions.map((d) => {
            const dark = [...d.palette].sort((a, b) => luma(a.hex) - luma(b.hex))[0]?.hex ?? "#211c35";
            const mine = images.filter((im) => im.direction === d.key);
            const hasLogo = mine.some((im) => im.kind === "logo");
            return (
              <section key={d.key} className="card break-inside-avoid overflow-hidden">
                <div className="p-6" style={{ background: dark, color: ink(dark) }}>
                  <div className="text-xs uppercase tracking-[0.25em] opacity-80">Dirección {d.key}{data.recommendation.key === d.key ? " · recomendada" : ""}</div>
                  <h2 className="mt-2 text-4xl" style={{ fontFamily: `"${d.typography.display}", serif` }}>{d.name}</h2>
                  <p className="mt-3 max-w-3xl text-sm opacity-90">{d.concept}</p>
                </div>
                <div className="grid gap-6 p-6 lg:grid-cols-2">
                  <div className="space-y-5">
                    <div className="flex flex-wrap gap-2">{d.personality.map((p) => <span key={p} className="chip">{p}</span>)}</div>
                    <p className="text-sm"><span className="label">Para quién: </span>{d.audience}</p>
                    <div className="space-y-1" style={{ fontFamily: `"${d.typography.display}", serif` }}>
                      <p className="text-2xl italic">“{d.taglineEs}”</p>
                      <p className="text-xl italic text-muted">“{d.taglineEn}”</p>
                    </div>
                    <div>
                      <div className="label">Paleta</div>
                      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {d.palette.map((c) => (
                          <div key={c.hex} className="overflow-hidden rounded-lg border border-line">
                            <div className="h-14" style={{ background: c.hex }} />
                            <div className="p-1.5 text-[11px] leading-tight"><div className="font-semibold">{c.name}</div><div className="font-mono text-muted">{c.hex}</div><div className="text-muted">{c.role}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-line p-3">
                        <div className="text-4xl" style={{ fontFamily: `"${d.typography.display}", serif` }}>Aa</div>
                        <div className="mt-1 text-sm font-semibold">{d.typography.display}</div>
                        <div className="text-xs text-muted">Títulos y logo{d.typography.premiumAlt ? ` · de pago: ${d.typography.premiumAlt}` : ""}</div>
                      </div>
                      <div className="rounded-lg border border-line p-3">
                        <div className="text-4xl" style={{ fontFamily: `"${d.typography.text}", sans-serif` }}>Aa</div>
                        <div className="mt-1 text-sm font-semibold">{d.typography.text}</div>
                        <div className="text-xs text-muted">Textos</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted">{d.typography.why}</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="label">Logo</div>
                      <p className="mt-1 text-sm">{d.logoConcept}</p>
                      <div className="mt-3 flex flex-wrap items-start gap-2 print:hidden">
                        {isAgency ? <GenerateImage clientId={id} rebrandId={rid} direction={d.key} kind="logo" label="Generar logo" /> : null}
                        {isAgency ? <GenerateImage clientId={id} rebrandId={rid} direction={d.key} kind="monogram" label="Generar monograma" /> : null}
                        <CopyText text={d.logoPrompt} label="Copiar prompt del logo" />
                        <CopyText text={d.monogramPrompt} label="Copiar prompt del monograma" />
                      </div>
                    </div>
                    {mine.length ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {mine.map((im) => (
                          <figure key={im.path} className="space-y-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={signed.get(im.path)} alt={`${KIND[im.kind]} ${im.label}`} className="aspect-square w-full rounded-lg border border-line object-cover" />
                            <figcaption className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
                              {im.kind === "mockup" ? im.label : KIND[im.kind]}
                              {signed.get(im.path) ? <a href={signed.get(im.path)} target="_blank" className="underline print:hidden">abrir</a> : null}
                              {isAgency && im.kind === "logo" ? (
                                official.has(im.path) ? (
                                  <span className="text-ok">· logo oficial</span>
                                ) : (
                                  <form action={adoptRebrandLogoAction.bind(null, id, rid, im.path)} className="print:hidden">
                                    <SubmitButton className="underline">usar como oficial</SubmitButton>
                                  </form>
                                )
                              ) : null}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : null}
                    <div>
                      <div className="label">Mockups</div>
                      <ul className="mt-2 space-y-2">
                        {d.mockups.map((m, k) => (
                          <li key={k} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                            <span className="flex-1">{m.label}</span>
                            <span className="flex flex-wrap gap-2 print:hidden">
                              {isAgency ? <GenerateImage clientId={id} rebrandId={rid} direction={d.key} kind="mockup" index={k} label="Generar" disabled={hasLogo ? null : "Primero genera el logo"} /> : null}
                              <CopyText text={m.prompt} label="Copiar prompt" />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-sm"><span className="label">En redes y video: </span>{d.contentStyle}</p>
                    <p className="text-sm text-muted"><span className="label">Riesgo: </span>{d.risks}</p>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="card space-y-4 p-6">
            <h2 className="text-xl font-semibold">Recomendación: dirección {data.recommendation.key}</h2>
            <p>{data.recommendation.why}</p>
            <div className="flex flex-wrap gap-2">{data.recommendation.ifPriority.map((x, k) => <span key={k} className="chip">{x}</span>)}</div>
          </section>

          <section className="card p-6">
            <h2 className="text-xl font-semibold">Plan de lanzamiento</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {data.launch.map((s, k) => (
                <div key={k} className="border-t-2 border-ink pt-3">
                  <div className="text-xs uppercase tracking-wide text-lavender">{s.timing}</div>
                  <div className="mt-1 font-semibold">{s.stage}</div>
                  <p className="mt-1 text-sm text-muted">{s.actions}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {isAgency ? (
        <form action={deleteRebrandAction.bind(null, id, rid)} className="mt-8 print:hidden">
          <SubmitButton className="btn btn-ghost text-bad">Borrar análisis</SubmitButton>
        </form>
      ) : null}
    </>
  );
}
