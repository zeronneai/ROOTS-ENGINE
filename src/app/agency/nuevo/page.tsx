export const dynamic = "force-dynamic";

import { requireAgency } from "@/server/auth";
import { NICHES } from "@/lib/styles/presets";
import { PLAN_TIERS } from "@/lib/types";
import { PageTitle, TopBar } from "@/components/Shell";
import { createClientAction } from "../../actions";

export default async function NewClient() {
  await requireAgency();
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <PageTitle kicker="Onboarding" title="Nuevo cliente" />
        <p className="-mt-4 mb-8 text-sm text-muted">
          Llena solo lo que ya sepan. Con las cuentas de redes el motor lee cómo habla la marca y arma el Brand Brain;
          el cliente después puede agregar referencias y moods desde su portal.
        </p>
        <form action={createClientAction} className="card space-y-6 p-6">
          <Grid>
            <Field label="Nombre del negocio *"><input name="name" required className="input" /></Field>
            <Field label="Giro">
              <select name="niche" className="input" defaultValue="">
                <option value="">Elegir...</option>
                {NICHES.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </Field>
            <Field label="Ciudad"><input name="city" defaultValue="El Paso, TX" className="input" /></Field>
            <Field label="Idioma del contenido">
              <select name="language" className="input" defaultValue="es">
                <option value="es">Español</option>
                <option value="en">Inglés</option>
                <option value="bilingual">Bilingüe</option>
              </select>
            </Field>
            <Field label="Instagram del cliente"><input name="instagram" placeholder="@usuario" className="input" /></Field>
            <Field label="TikTok del cliente"><input name="tiktok" placeholder="@usuario" className="input" /></Field>
            <Field label="Sitio web"><input name="website" className="input" /></Field>
            <Field label="Plan">
              <select name="plan_tier" className="input" defaultValue="plan">
                {Object.entries(PLAN_TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
          </Grid>
          <Field label="Referencias en Instagram (opcional, el motor busca competencia solo)">
            <textarea name="competitors_ig" rows={2} className="input" placeholder="@competidor1 @competidor2" />
          </Field>
          <Field label="Referencias en TikTok (opcional)">
            <textarea name="competitors_tt" rows={2} className="input" placeholder="@competidor1 @competidor2" />
          </Field>
          <Field label="Lo que ya sabemos del cliente (oferta, público, tono, qué puede grabar, lo que NO quiere)">
            <textarea name="notes" rows={6} className="input" />
          </Field>
          <Field label="Correo del cliente para darle acceso (opcional)">
            <input name="client_email" type="email" className="input" />
          </Field>
          <button className="btn btn-primary">Crear cliente</button>
        </form>
      </main>
    </>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
