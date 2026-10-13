import { loadClient } from "@/server/load";
import { ApiButton } from "@/components/ApiButton";
import { Empty, PageTitle } from "@/components/Shell";
import { addCompetitorsAction, removeCompetitorAction } from "@/app/actions";
import type { PostAnalysis } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

const fmt = (n: number | null) =>
  n == null ? "n/d" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(n);

export default async function CompetenciaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, isAgency } = await loadClient(id);
  const [{ data: comps }, { data: posts }] = await Promise.all([
    db.from("competitors").select("*").eq("client_id", id).order("created_at"),
    db
      .from("competitor_posts")
      .select("*, competitors!inner(handle, is_own_account)")
      .eq("client_id", id)
      .eq("competitors.is_own_account", false)
      .order("outlier_score", { ascending: false, nullsFirst: false })
      .limit(24),
  ]);

  const hasWatch = (comps ?? []).some((c) => !c.is_own_account);

  return (
    <>
      <PageTitle kicker="02 · Competencia" title="Lo que le está funcionando a tu giro">
        {isAgency ? (
          <>
            <ApiButton url={`/api/clients/${id}/discover`} label="✦ Buscar competencia con IA" busyLabel="Investigando (1-2 min)..." variant={hasWatch ? "ghost" : "primary"} />
            {hasWatch ? (
              <>
                <ApiButton url={`/api/clients/${id}/scan`} body={{ skipScan: true }} label="Solo analizar" busyLabel="Analizando..." variant="ghost" />
                <ApiButton url={`/api/clients/${id}/scan`} label="Escanear y analizar" busyLabel="Escaneando (1-3 min)..." />
              </>
            ) : null}
          </>
        ) : null}
      </PageTitle>

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <section>
          {!posts?.length ? (
            <Empty title="Sin escaneo todavía">
              {hasWatch
                ? "Dale a “Escanear y analizar”. El motor encuentra los videos outlier (los que pegaron muy por encima de su promedio) y los desarma."
                : "Dale a “Buscar competencia con IA”: el motor investiga los hashtags del giro y la zona, encuentra quién está pegando y lo agrega solo. Después escaneas."}
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((p) => {
                const a = p.analysis as PostAnalysis | null;
                return (
                  <article key={p.id} className="card overflow-hidden">
                    <div className="flex gap-4 p-4">
                      {p.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumbnail_url} alt="" referrerPolicy="no-referrer" className="h-28 w-20 shrink-0 rounded-lg bg-line object-cover" />
                      ) : (
                        <div className="h-28 w-20 shrink-0 rounded-lg bg-line" />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-semibold">@{p.competitors.handle}</span>
                          <span className="chip">{p.platform}</span>
                        </div>
                        <div className="mt-2 flex items-baseline gap-3">
                          <span className="text-2xl font-bold">{fmt(p.views)}</span>
                          {p.outlier_score ? (
                            <span className={`text-sm font-semibold ${p.outlier_score >= 3 ? "text-ok" : "text-lavender"}`}>
                              ×{Number(p.outlier_score).toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted">{p.caption}</p>
                        {p.url ? (
                          <a href={p.url} target="_blank" className="mt-1 inline-block text-xs text-lavender">
                            Ver video ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    {a ? (
                      <div className="space-y-3 border-t border-line/60 p-4 text-sm">
                        <div>
                          <div className="label">El hook · {a.hookType}</div>
                          <p className="mt-1 font-medium">“{a.hook}”</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {a.pattern.map((b, i) => (
                            <span key={i} className="chip">{b}</span>
                          ))}
                        </div>
                        <div>
                          <div className="label">Por qué funcionó</div>
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                            {a.whyItWorked.map((w, i) => <li key={i}>{w}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-lg bg-purple/10 p-3">
                          <div className="label">Tu versión</div>
                          <p className="mt-1">{a.adaptationForClient}</p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="card p-5">
            <div className="mb-3 font-semibold">Cuentas vigiladas</div>
            <ul className="space-y-2 text-sm">
              {(comps ?? []).map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2" title={c.note ?? undefined}>
                  <span className="chip">{c.platform === "instagram" ? "IG" : "TT"}</span>
                  <a href={c.platform === "instagram" ? `https://instagram.com/${c.handle}` : `https://tiktok.com/@${c.handle}`} target="_blank" className="truncate hover:text-lavender">@{c.handle}</a>
                  {c.is_own_account ? <span className="chip text-ok">tuya</span> : null}
                  {c.origin === "auto" ? <span className="chip text-lavender">IA · {c.kind === "reference" ? "referencia" : "competencia"}</span> : null}
                  <span className="ml-auto text-xs text-muted">{c.median_views ? `med ${fmt(Number(c.median_views))}` : ""}</span>
                  {isAgency ? (
                    <form action={removeCompetitorAction.bind(null, id, c.id)}>
                      <SubmitButton className="text-xs text-muted hover:text-bad">✕</SubmitButton>
                    </form>
                  ) : null}
                  {c.note ? <p className="w-full text-xs text-muted">{c.note}</p> : null}
                </li>
              ))}
            </ul>
          </div>
          <form action={addCompetitorsAction.bind(null, id)} className="card space-y-3 p-5">
            <div className="font-semibold">{isAgency ? "Agregar referencias (opcional)" : "¿A quién admiras o con quién compites?"}</div>
            <p className="text-xs text-muted">El motor busca solo. Aquí puedes sumar cuentas que ya conozcas.</p>
            <select name="platform" className="input" defaultValue="instagram">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
            <textarea name="handles" rows={3} className="input" placeholder="@cuenta1 @cuenta2" />
            <SubmitButton className="btn btn-primary w-full">{isAgency ? "Agregar" : "Sugerir"}</SubmitButton>
          </form>
        </aside>
      </div>
    </>
  );
}
