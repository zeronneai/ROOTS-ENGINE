import { loadClient } from "@/server/load";
import { fmtDate } from "@/lib/time";
import { ApiButton } from "@/components/ApiButton";
import { Empty, PageTitle } from "@/components/Shell";
import { addBrandInputAction, deleteBrandInputAction } from "@/app/actions";
import type { BrandBrain } from "@/lib/types";
import { SubmitButton } from "@/components/SubmitButton";

export default async function MarcaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, brand, isAgency, moods } = await loadClient(id);
  const { data: inputs } = await db.from("brand_inputs").select("*").eq("client_id", id).order("created_at", { ascending: false });
  const b = brand.data as Partial<BrandBrain>;
  const pending = (inputs ?? []).filter((i) => !i.synthesized).length;

  return (
    <>
      <PageTitle kicker="01 · Brand Brain" title="Así entiende el motor a la marca">
        {isAgency ? (
          <ApiButton url={`/api/clients/${id}/engine/own`} label="Traer datos de Google y redes" busyLabel="Buscando (1-2 min)..." variant="ghost" />
        ) : null}
        <ApiButton
          url={`/api/clients/${id}/synthesize`}
          label={pending ? `Actualizar con ${pending} cosa${pending > 1 ? "s" : ""} nueva${pending > 1 ? "s" : ""}` : "Re-sintetizar"}
          busyLabel="Pensando..."
        />
      </PageTitle>

      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {!brand.synthesized_at ? (
            <Empty title="Todavía no hay Brand Brain">
              Agrega notas, links o referencias a la derecha (o las respuestas del onboarding) y dale a “Re-sintetizar”.
            </Empty>
          ) : (
            <>
              <div className="card p-5">
                <div className="text-xl font-semibold">{b.businessName}</div>
                <p className="mt-1 text-muted">{b.oneLiner}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="chip">{b.city}</span>
                  <span className="chip">{b.language === "bilingual" ? "Bilingüe" : b.language === "en" ? "Inglés" : "Español"}</span>
                  {b.voice?.tone?.map((t) => <span key={t} className="chip">{t}</span>)}
                </div>
                {b.languageNotes ? <p className="mt-3 text-sm text-muted">{b.languageNotes}</p> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Block title="Oferta" items={[...(b.offer?.mainProducts ?? []), b.offer?.priceRange ? `Precio: ${b.offer.priceRange}` : ""]} />
                <Block title="Lo que los hace distintos" items={b.offer?.differentiators} />
                <Block title={`Público: ${b.audience?.who ?? ""}`} items={b.audience?.pains?.map((p) => `Dolor: ${p}`).concat(b.audience?.desires?.map((d) => `Quiere: ${d}`) ?? [])} />
                <Block title="Objeciones" items={b.audience?.objections} />
                <Block title="Así habla la marca" items={b.voice?.sampleLines?.map((l) => `“${l}”`)} />
                <Block title="Sí / No" items={[...(b.voice?.dos ?? []).map((d) => `✓ ${d}`), ...(b.voice?.donts ?? []).map((d) => `✗ ${d}`)]} />
                <Block title="Pilares de contenido" items={b.content?.pillars} />
                <Block title="Con qué pueden grabar" items={[...(b.content?.canRecord ?? []), b.content?.constraints ?? ""]} />
                <Block title="Llamado a la acción" items={[b.cta?.primary, b.cta?.secondary]} />
                <Block title="Evitar" items={b.avoid} />
              </div>
              <div className="card flex flex-wrap items-center gap-4 p-5">
                <Swatch c={b.visual?.primaryColor} l="Principal" />
                <Swatch c={b.visual?.accentColor} l="Acento (subtítulos)" />
                <div className="text-sm text-muted">
                  Mood visual: <span className="text-ink">{b.visual?.mood}</span>
                  <br />
                  Estilo recomendado: <span className="text-lavender">{b.visual?.recommendedPresetId}</span>. {b.visual?.presetReason}
                </div>
              </div>
            </>
          )}
        </div>

        <aside className="space-y-4">
          <form action={addBrandInputAction.bind(null, id)} className="card space-y-3 p-5">
            <div className="font-semibold">Agregar a la marca</div>
            <p className="text-xs text-muted">
              {isAgency
                ? "Lo que sepan del cliente: notas de juntas, precios, lo que no le gusta."
                : "Cuéntanos lo que quieras: referencias que te gustan, cambios en tu negocio, promos, cómo te quieres ver."}
            </p>
            <select name="kind" className="input" defaultValue="note">
              <option value="note">Nota</option>
              <option value="link">Link</option>
              <option value="reference_video">Video de referencia</option>
              <option value="voice_sample">Así hablo yo</option>
            </select>
            <input name="title" className="input" placeholder="Título (opcional)" />
            <textarea name="content" rows={4} className="input" placeholder="Escribe aquí" />
            <input name="url" className="input" placeholder="https://... (opcional)" />
            {moods.length ? (
              <select name="mood_id" className="input" defaultValue="">
                <option value="">Aplica siempre</option>
                {moods.map((m) => <option key={m.id} value={m.id}>Solo para el mood: {m.name}</option>)}
              </select>
            ) : null}
            <SubmitButton className="btn btn-primary w-full">Agregar</SubmitButton>
          </form>

          <div className="card p-5">
            <div className="mb-3 font-semibold">Historial</div>
            <ul className="space-y-3">
              {(inputs ?? []).map((i) => (
                <li key={i.id} className="border-b border-line/50 pb-3 text-sm last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`chip ${i.added_by_role === "client" ? "text-ok" : ""}`}>{i.added_by_role === "client" ? "Cliente" : "Agencia"}</span>
                    <span className="text-xs text-muted">{fmtDate(i.created_at)}</span>
                    {!i.synthesized ? <span className="chip text-warn">nuevo</span> : null}
                    {isAgency ? (
                      <form action={deleteBrandInputAction.bind(null, id, i.id)} className="ml-auto">
                        <SubmitButton className="text-xs text-muted hover:text-bad">borrar</SubmitButton>
                      </form>
                    ) : null}
                  </div>
                  {i.title ? <div className="mt-1 font-medium">{i.title}</div> : null}
                  {i.content ? <p className="mt-1 whitespace-pre-wrap text-muted">{i.content}</p> : null}
                  {i.url ? <a href={i.url} target="_blank" className="mt-1 block truncate text-lavender">{i.url}</a> : null}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}

function Block({ title, items }: { title: string; items?: (string | undefined | null)[] }) {
  const list = (items ?? []).filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <div className="card p-5">
      <div className="label">{title}</div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {list.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}

function Swatch({ c, l }: { c?: string; l: string }) {
  if (!c) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="h-8 w-8 rounded-lg border border-line" style={{ background: c }} />
      <div className="text-xs">
        <div>{l}</div>
        <div className="text-muted">{c}</div>
      </div>
    </div>
  );
}
